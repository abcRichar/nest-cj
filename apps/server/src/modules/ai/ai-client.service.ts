import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

export interface ChatStreamPayload {
  threadId: string;
  userId: number;
  roleCode: string;
  systemPrompt: string;
  message: string;
  enableSearch: boolean;
}

export interface ReportPayload {
  userId: number;
  nickname: string;
  date: string;
  stats: Record<string, unknown>;
}

/**
 * 主业务服务 -> AI 服务 的内部客户端
 * 通过 AI_SERVICE_TOKEN 做内部鉴权，业务服务不直接持有大模型密钥。
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const ai = this.config.get('ai');
    this.http = axios.create({
      baseURL: ai.baseUrl,
      timeout: ai.timeout,
      headers: { 'x-internal-token': ai.token },
    });
  }

  /** 生成学习日报正文 */
  async generateReport(payload: ReportPayload): Promise<string> {
    try {
      const { data } = await this.http.post('/api/ai/report', payload);
      return data?.data?.content ?? data?.content ?? '';
    } catch (e) {
      this.logger.error(`调用 AI 日报服务失败：${(e as Error).message}`);
      throw new ServiceUnavailableException('AI 服务暂不可用');
    }
  }

  /**
   * 发起流式对话。
   * 返回的是 fetch 的 ReadableStream 读取器，由调用方直接转发给浏览器（SSE）。
   */
  async openChatStream(payload: ChatStreamPayload): Promise<{
    ok: boolean;
    status: number;
    body?: ReadableStream<Uint8Array> | null;
    text?: string;
  }> {
    const ai = this.config.get('ai');
    const res = await fetch(`${ai.baseUrl}/api/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-internal-token': ai.token,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      return { ok: false, status: res.status, text: await res.text().catch(() => '') };
    }
    return { ok: true, status: res.status, body: res.body };
  }

  /** 健康检查 */
  async health() {
    try {
      const { data } = await this.http.get('/api/ai/health', { timeout: 3000 });
      return { up: true, ...data };
    } catch (e) {
      return { up: false, message: (e as Error).message };
    }
  }
}
