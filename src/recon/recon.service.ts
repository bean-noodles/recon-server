import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import OpenAI from 'openai';

interface SiteReconResult {
  degree: 'safe' | 'caution' | 'danger';
  reason: string;
}

@Injectable()
export class ReconService {
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async siteRecon(
    data: {
      webData: { title: string; url: string; description: string };
      userId?: string;
    },
    clientIp: string,
  ): Promise<{ degree: string; reason: string }> {
    const prompt = `
### Role
너는 보안 관제 센터(SOC)에서 근무하는 L3 시니어 사이버 보안 분석가야. 
웹 메타데이터의 구조적 결함, 사회공학적 공격 기법, 브랜드 도용 패턴을 정밀 분석하여 피싱 여부를 실시간 판별하는 것이 네 임무야.

### Analysis Logic (Detailed)
1. **Infrastructure Analysis:** 도메인의 엔트로피(무작위성), TLD의 평판 데이터, 서브도메인의 계층 구조를 기술적으로 검토한다.
2. **Social Engineering Detection:** 사용자의 심리적 취약점을 파고드는 긴급성(Urgency), 공포(Fear), 금전적 유혹(Greed) 키워드의 빈도와 맥락을 분석한다.
3. **Identity Verification:** HTML 타이틀 및 메타 정보에 명시된 브랜드 자산(Brand Assets)과 실제 호스팅 도메인의 일치 여부를 교차 검증한다.

### Response Rules
- **반드시** 유효한 JSON 형식으로만 응답하며, 마크다운 코드 블록 없이 순수 텍스트로만 출력한다.
- **'reason' 작성 가이드라인:**
  1. **safe**: 위험 등급이 safe일 경우, 사유는 반드시 **"분석 결과, 해당 사이트에서 피싱 및 보안 위협 징후가 발견되지 않았습니다."**로 고정한다.
  2. **caution/danger**: 전문적인 보안 용어를 활용하되 일반 사용자가 위험의 근거를 명확히 알 수 있도록 **구체적인 한국어 문장**으로 작성한다. 
  3. **영문 코드(예: SUSPICIOUS_TLD)는 절대 노출하지 않는다.**
  4. 단순 요약이 아닌, "어떤 지표에서 어떤 위협이 감지되었는지"를 포함한다 (예: "유명 금융 브랜드를 사칭하면서 비정상적인 도메인 경로를 통해 개인정보 입력을 유도하고 있습니다.")

### Severity Definition
- **safe**: 인가된 도메인 구조를 가졌으며 악의적인 스크립트나 심리적 조작 패턴이 전무함.
- **caution**: 도메인 구성이 비전형적이거나, 공격에 악용될 소지가 있는 단축 URL/서브도메인 구조가 발견됨.
- **danger**: 브랜드 사칭, 자격 증명 탈취(Credential Phishing) 목적의 입력 폼, 위조된 도메인 등 명백한 공격 의도가 확인됨.

### 분석 참조 지표 (출력 시 전문적인 문장으로 변환할 것)
- **URL 지표:** 무작위 문자열 엔트로피 증가, 비정상적 하위 디렉토리 깊이, 브랜드 키워드 오용, IP 기반 호스팅, 유사 문자(Homoglyph) 공격, 저신뢰 TLD 활용.
- **Content 지표:** 계정 정지 위협, 암호화폐 복구 스캠, 가짜 고객지원 세션, 부자연스러운 기계 번역 문구, 권한 없는 브랜드 로고 사용 명시.

### Input Data
${JSON.stringify(data.webData, null, 2)}

### Task
입력된 데이터를 바탕으로 위협 인텔리전스 분석을 수행하고 그 결과를 JSON으로 출력하시오.

### Output Format
{
  "degree": "safe" | "caution" | "danger",
  "reason": "전문적인 분석 결과가 포함된 한국어 설명"
}
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 웹사이트 보안 분석 전문가입니다. 항상 지정된 JSON 형식으로만 응답합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('GPT 응답이 비어있습니다.');
      }
      console.log(JSON.stringify(data, null, 2));

      const parsed: unknown = JSON.parse(responseContent);

      // 타입 검증
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('degree' in parsed) ||
        !('reason' in parsed)
      ) {
        throw new Error('GPT 응답 형식이 올바르지 않습니다.');
      }

      const result = parsed as SiteReconResult;

      // 사용자 존재 여부 확인 및 유효하지 않은 userId 처리
      let validUserId = data.userId;
      if (validUserId) {
        const userExists = await this.prisma.user.findUnique({
          where: { id: validUserId },
        });
        if (!userExists) {
          console.warn(
            `Invalid userId provided: ${validUserId}. Proceeding without linking user.`,
          );
          validUserId = undefined;
        }
      }

      // 결과를 DB에 저장
      await this.prisma.site.create({
        data: {
          degree: result.degree,
          reason: result.reason,
          clientIp: clientIp,
          requestTime: new Date(),
          requestObject: JSON.stringify(data.webData),
          userId: validUserId,
        },
      });

      return {
        degree: result.degree,
        reason: result.reason,
      };
    } catch (error) {
      console.error('GPT 분석 오류:', error);
      throw error;
    }
  }
}
