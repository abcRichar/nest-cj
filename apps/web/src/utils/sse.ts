import type { StreamEvent } from '@elp/shared';

export interface SSECallbacks {
  onStart?: (e: StreamEvent) => void;
  onDelta?: (text: string, e: StreamEvent) => void;
  onTool?: (tool: NonNullable<StreamEvent['tool']>) => void;
  onUsage?: (usage: NonNullable<StreamEvent['usage']>) => void;
  onDone?: (e: StreamEvent) => void;
  onError?: (msg: string) => void;
}

export interface SSEHandle {
  abort: () => void;
}

/**
 * 基于 fetch + ReadableStream 的 SSE 客户端
 *
 * 为什么不用 EventSource：
 *   1. EventSource 只支持 GET，无法提交 JSON body
 *   2. EventSource 无法携带 Authorization 头
 *   3. 需要 AbortController 主动中断生成
 */
export function streamChat(
  url: string,
  body: Record<string, unknown>,
  callbacks: SSECallbacks,
  options: { token?: string; base?: string } = {},
): SSEHandle {
  const controller = new AbortController();
  const base = options.base ?? import.meta.env.VITE_API_BASE ?? '/api';
  const token = options.token ?? localStorage.getItem('elp_token') ?? '';

  (async () => {
    try {
      const res = await fetch(`${base}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        callbacks.onError?.(text || `请求失败（${res.status}）`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }
          dispatch(evt, callbacks);
        }
      }
      callbacks.onDone?.({ type: 'done' });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        callbacks.onDone?.({ type: 'done' });
        return;
      }
      callbacks.onError?.(e?.message ?? '流式请求异常');
    }
  })();

  return { abort: () => controller.abort() };
}

function dispatch(evt: StreamEvent, cb: SSECallbacks) {
  switch (evt.type) {
    case 'start':
      cb.onStart?.(evt);
      break;
    case 'delta':
      if (evt.content) cb.onDelta?.(evt.content, evt);
      break;
    case 'tool':
      if (evt.tool) cb.onTool?.(evt.tool);
      break;
    case 'usage':
      if (evt.usage) cb.onUsage?.(evt.usage);
      break;
    case 'done':
      cb.onDone?.(evt);
      break;
    case 'error':
      cb.onError?.(evt.error ?? '未知错误');
      break;
  }
}
