import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import OpenAI from 'openai';

interface SiteReconResult {
  degree: 'safe' | 'caution' | 'danger';
  reason: string[];
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
      title: string;
      url: string;
      description: string;
    },
    clientIp: string,
  ): Promise<{ degree: string; reason: string[] }> {
    const prompt = `
당신은 웹사이트 보안 분석 전문가입니다. 주어진 사이트 정보를 분석하여 안전도를 평가해주세요.

분석할 사이트 정보:
${JSON.stringify(data, null, 2)}

다음 형식으로만 응답해주세요 (JSON):
{
  "degree": "safe" | "caution" | "danger",
  "reason": ["이유1", "이유2", ...]
}

- safe: 안전한 사이트
- caution: 주의가 필요한 사이트
- danger: 위험한 사이트

반드시 유효한 JSON 형식으로만 응답하세요.
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

      // 결과를 DB에 저장
      await this.prisma.site.create({
        data: {
          degree: result.degree,
          reason: result.reason,
          clientIp: clientIp,
          requestTime: new Date(),
          requestObject: JSON.stringify(data),
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
