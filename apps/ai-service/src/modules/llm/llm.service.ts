import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

/**
 * DeepSeek 使用 OpenAI 兼容协议，因此直接复用 ChatOpenAI，
 * 只把 baseURL 指向 DeepSeek 网关即可。
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly model: ChatOpenAI | null = null;

  readonly modelName: string;
  readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const ds = this.config.get('ai.deepseek');
    this.modelName = ds.model;
    this.configured = Boolean(ds.apiKey && !ds.apiKey.includes('xxxx'));

    if (this.configured) {
      this.model = new ChatOpenAI({
        model: ds.model,
        temperature: ds.temperature,
        maxTokens: ds.maxTokens,
        apiKey: ds.apiKey,
        configuration: { baseURL: ds.baseUrl },
        streaming: true,
      });
      this.logger.log(`LLM 已就绪：${ds.model} @ ${ds.baseUrl}`);
    } else {
      this.logger.warn('未配置 DEEPSEEK_API_KEY，AI 服务将运行在「演示模式」');
    }
  }

  get instance(): ChatOpenAI {
    if (!this.model) throw new Error('LLM 未配置');
    return this.model;
  }

  /** 日报等一次性生成场景 */
  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.model) return '';
    const res = await this.model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    return typeof res.content === 'string'
      ? res.content
      : (res.content as any[]).map((c) => ('text' in c ? c.text : '')).join('');
  }
}
