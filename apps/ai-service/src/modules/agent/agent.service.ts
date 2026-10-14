import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { LlmService } from '../llm/llm.service';
import { createWebSearchTool } from '../tools/search.tool';
import { CheckpointService } from '../checkpoint/checkpoint.service';

export interface StreamChatInput {
  threadId: string;
  userId: number;
  roleCode: string;
  systemPrompt: string;
  message: string;
  enableSearch: boolean;
}

export interface AgentEvent {
  type: 'delta' | 'tool' | 'usage' | 'done' | 'error';
  content?: string;
  tool?: { name: string; input?: string; output?: string; status: 'running' | 'success' | 'error'; costMs?: number };
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

const DEFAULT_SYSTEM_PROMPT = `你是一名专业的英语学习助手，帮助学生提升英语听说读写能力。
回答要求：
1. 优先用中文解释，英文例句保留英文原文；
2. 讲解语法/词汇时给出清晰的对比和例句；
3. 语气亲切，鼓励为主，不要输出与英语学习无关的内容。`;

/** 保留最近 N 轮上下文，控制 token 成本 */
const MAX_CONTEXT_MESSAGES = 20;

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private app: any;
  private readonly maxIterations: number;

  constructor(
    private readonly llm: LlmService,
    private readonly checkpoint: CheckpointService,
    private readonly config: ConfigService,
  ) {
    this.maxIterations = this.config.get<number>('ai.agent.maxIterations') ?? 8;
  }

  onModuleInit() {
    if (!this.llm.configured) {
      this.logger.warn('LLM 未配置，Agent 图不会构建（走演示模式）');
      return;
    }
    this.buildGraph();
  }

  /**
   * 用 StateGraph 手写 ReAct 循环：
   *   agent -> (有 tool_calls?) -> tools -> agent -> ... -> END
   * 相比 createReactAgent 黑盒，这里能直接看到「思考-行动-观察」的每一跳。
   */
  private buildGraph() {
    const searchTool = createWebSearchTool({
      tavilyApiKey: this.config.get<string>('ai.search.tavilyApiKey') ?? '',
      maxResults: this.config.get<number>('ai.search.maxResults') ?? 5,
    });
    const tools: any[] = [searchTool];
    const toolNode = new ToolNode(tools);
    const llmWithTools = this.llm.instance.bindTools(tools);

    const callModel = async (state: typeof MessagesAnnotation.State, runtimeConfig: any) => {
      const systemPrompt: string =
        runtimeConfig?.configurable?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      const enableSearch: boolean = runtimeConfig?.configurable?.enableSearch !== false;

      // 上下文窗口裁剪：只带最近 N 条进模型
      const history = state.messages.slice(-MAX_CONTEXT_MESSAGES);
      const messages = [new SystemMessage(systemPrompt), ...history];

      const model = enableSearch ? llmWithTools : this.llm.instance;
      const response = await model.invoke(messages);
      return { messages: [response] };
    };

    const shouldContinue = (state: typeof MessagesAnnotation.State) => {
      const last = state.messages[state.messages.length - 1] as AIMessage;
      const hasToolCall = Array.isArray(last.tool_calls) && last.tool_calls.length > 0;
      return hasToolCall ? 'tools' : END;
    };

    const checkpointer = this.checkpoint.instance;
    const graph = new StateGraph(MessagesAnnotation)
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', shouldContinue, ['tools', END])
      .addEdge('tools', 'agent');

    this.app = checkpointer ? graph.compile({ checkpointer }) : graph.compile();
    this.logger.log(
      `ReAct Agent 已构建（tools=${tools.length}, checkpoint=${checkpointer ? 'MySQL' : 'none'}, maxIterations=${this.maxIterations}）`,
    );
  }

  get ready() {
    return Boolean(this.app);
  }

  /**
   * 流式执行 Agent，逐事件产出：
   *   delta（模型增量文本）/ tool（工具调用轨迹）/ usage（token 用量）
   */
  async *streamChat(input: StreamChatInput): AsyncGenerator<AgentEvent> {
    if (!this.app) {
      yield* this.mockStream(input);
      return;
    }

    const startedAt = Date.now();
    const toolStartAt = new Map<string, number>();

    try {
      const eventStream = this.app.streamEvents(
        { messages: [new HumanMessage(input.message)] },
        {
          version: 'v2',
          recursionLimit: this.maxIterations * 2,
          configurable: {
            thread_id: input.threadId,
            systemPrompt: input.systemPrompt,
            enableSearch: input.enableSearch,
            userId: input.userId,
            roleCode: input.roleCode,
          },
        },
      );

      for await (const ev of eventStream as AsyncIterable<any>) {
        switch (ev.event) {
          case 'on_chat_model_stream': {
            const chunk = ev.data?.chunk;
            const text = extractText(chunk?.content);
            if (text) yield { type: 'delta', content: text };
            break;
          }
          case 'on_tool_start': {
            toolStartAt.set(ev.name ?? 'tool', Date.now());
            yield {
              type: 'tool',
              tool: {
                name: ev.name ?? 'tool',
                input: safeStringify(ev.data?.input),
                status: 'running',
              },
            };
            break;
          }
          case 'on_tool_end': {
            const started = toolStartAt.get(ev.name ?? 'tool');
            yield {
              type: 'tool',
              tool: {
                name: ev.name ?? 'tool',
                output: truncate(safeStringify(ev.data?.output), 1200),
                status: 'success',
                costMs: started ? Date.now() - started : undefined,
              },
            };
            break;
          }
          case 'on_tool_error': {
            yield {
              type: 'tool',
              tool: {
                name: ev.name ?? 'tool',
                output: String(ev.data?.error ?? '工具执行异常'),
                status: 'error',
              },
            };
            break;
          }
          case 'on_chat_model_end': {
            const usage = ev.data?.output?.usage_metadata;
            if (usage) {
              yield {
                type: 'usage',
                usage: {
                  promptTokens: usage.input_tokens ?? 0,
                  completionTokens: usage.output_tokens ?? 0,
                  totalTokens: usage.total_tokens ?? 0,
                },
              };
            }
            break;
          }
          default:
            break;
        }
      }

      this.logger.log(
        `会话 ${input.threadId} 完成一轮对话，耗时 ${Date.now() - startedAt}ms（搜索=${input.enableSearch}）`,
      );
      yield { type: 'done' };
    } catch (e) {
      const msg = (e as Error).message ?? 'Agent 执行失败';
      this.logger.error(`Agent 执行异常 thread=${input.threadId}：${msg}`);
      yield { type: 'error', error: msg };
    }
  }

  /** 未配置模型密钥时的演示流：逐字吐出，保证前端流式效果可验证 */
  private async *mockStream(input: StreamChatInput): AsyncGenerator<AgentEvent> {
    const text =
      `当前 AI 服务运行在**演示模式**（未配置 DEEPSEEK_API_KEY）。\n\n` +
      `收到的角色：${input.roleCode}\n` +
      `收到的问题：${input.message}\n\n` +
      `配置方式：在 apps/ai-service/.env 中填写 DEEPSEEK_API_KEY 后重启服务，` +
      `即可体验 ReAct Agent、联网搜索与多轮上下文记忆。`;

    if (input.enableSearch) {
      yield {
        type: 'tool',
        tool: { name: 'web_search', input: JSON.stringify({ query: input.message }), status: 'running' },
      };
      await sleep(260);
      yield {
        type: 'tool',
        tool: {
          name: 'web_search',
          output: '（演示模式）未真正发起检索',
          status: 'success',
          costMs: 260,
        },
      };
    }

    for (const ch of chunkText(text, 3)) {
      await sleep(16);
      yield { type: 'delta', content: ch };
    }
    yield {
      type: 'usage',
      usage: {
        promptTokens: Math.ceil(input.message.length / 2),
        completionTokens: Math.ceil(text.length / 2),
        totalTokens: Math.ceil((input.message.length + text.length) / 2),
      },
    };
    yield { type: 'done' };
  }
}

/* ----------------------------- helpers ----------------------------- */

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (typeof c === 'string' ? c : (c?.text ?? '')))
      .join('');
  }
  return '';
}

function safeStringify(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
