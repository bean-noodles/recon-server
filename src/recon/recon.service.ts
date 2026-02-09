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
너는 보안 관제 센터(SOC)에서 근무하는 베테랑 사이버 보안 분석가야. 
제공된 웹사이트 메타데이터를 분석하여 피싱(Phishing), 스캠(Scam), 사칭(Impersonation) 여부를 실시간으로 판별하는 것이 네 임무야.

### Analysis Logic (Step-by-Step)
1. **URL 분석:** 도메인 정당성, TLD 신뢰도, 서브도메인 조작 여부를 확인한다.
2. **콘텐츠 분석:** Title과 Description에서 긴급성, 위협, 금융 보상 등 심리적 조작 기법을 포착한다.
3. **교차 검증:** 도메인과 브랜드 언급 사이의 불일치를 찾는다.
4. **최종 판단:** 분석된 지표를 바탕으로 위험 등급과 사유를 결정한다.

### Response Rules
- **반드시** 유효한 JSON 형식으로만 응답하며, 다른 부연 설명은 일절 생략한다.
- **'reason' 출력 규칙:** 1. 모든 사유는 영문 코드(예: SUSPICIOUS_TLD)를 제외하고, **한국어 문장으로만** 작성한다.
  2. 'degree'가 **"safe"**인 경우, 'reason' 에는 반드시 **"피싱 사이트 징후가 없습니다."**라는 문구만 포함한다.
  3. 'degree'가 **"caution"** 또는 **"danger"**인 경우, 아래 '사유 레퍼런스'를 참고하여 일반 사용자가 이해하기 쉬운 구체적인 한국어 문장으로 작성한다.

### Severity Definition
- **safe**: 신뢰할 수 있는 도메인이며 위험 징후가 없음.
- **caution**: 사유가 1~2개 발견되거나, 피싱은 아니지만 사용자 주의가 필요한 경우.
- **danger**: 명백한 사칭, 고위험 키워드 조합 등 악의적 의도가 다수 감지됨.

### 사유 레퍼런스 (내부 분석용 코드를 설명으로 변환하여 사용)
- URL: 무작위 문자열 경로, 과도한 하위 디렉토리, 오해 유발 키워드 포함, IP 주소 사용, 단축 URL 사용, 유사 문자 위조 도메인, 신뢰도가 낮은 최상위 도메인(TLD), 비정상적인 서브도메인 구조 등
- TITLE/DESC: 유명 브랜드 사칭, 긴급한 조치 요구, 보상 및 에어드랍 유혹, 금융 및 암호화폐 관련 위험 단어, 로그인/개인정보 요구, 부자연스러운 번역체 등

### Input Data
${JSON.stringify(data.webData, null, 2)}

### Task
위 데이터를 분석하여 피싱 위험도를 판별하고 JSON 형식으로 응답하시오.

### Output Format
{
  "degree": "safe" | "caution" | "danger",
  "reason": "한국어 설명"
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
