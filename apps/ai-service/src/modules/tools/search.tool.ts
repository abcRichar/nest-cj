import { tool } from '@langchain/core/tools';
import { z } from 'zod';

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOptions {
  tavilyApiKey: string;
  maxResults: number;
}

const searchSchema = z.object({
  query: z.string().describe('要检索的关键词或问题，尽量具体，可用中英文'),
});

const SEARCH_DESCRIPTION =
  '联网搜索工具。当问题涉及最新资讯、实时事件、时效性内容（如「今天的新闻」「最新的 XX 政策」）' +
  '或你不确定的事实时，必须先调用本工具获取资料，再基于检索结果作答。';

/**
 * 联网搜索工具（Agent 的 ReAct 行动之一）
 * 优先 Tavily（效果好），未配置则退化为 DuckDuckGo 免密钥通道。
 *
 * 注：tool() 的泛型推断较深，这里显式收敛为 any，避免 TS2589 递归实例化报错。
 */
export function createWebSearchTool(opts: WebSearchOptions): any {
  const run = async (input: { query: string }): Promise<string> => {
    const query = input?.query ?? '';
    const hits = opts.tavilyApiKey
      ? await searchWithTavily(query, opts.tavilyApiKey, opts.maxResults)
      : await searchWithDuckDuckGo(query, opts.maxResults);

    if (!hits.length) return `未检索到与「${query}」相关的实时信息。`;

    return hits
      .map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\n摘要: ${h.snippet}`)
      .join('\n\n');
  };

  return tool(run as any, {
    name: 'web_search',
    description: SEARCH_DESCRIPTION,
    schema: searchSchema as any,
  } as any);
}

async function searchWithTavily(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<SearchHit[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: any[] };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: String(r.content ?? '').slice(0, 500),
    }));
  } catch {
    return [];
  }
}

async function searchWithDuckDuckGo(query: string, maxResults: number): Promise<SearchHit[]> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'elp-ai-service/1.0' } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const hits: SearchHit[] = [];

    if (data.AbstractText) {
      hits.push({
        title: data.Heading ?? query,
        url: data.AbstractURL ?? '',
        snippet: data.AbstractText,
      });
    }
    for (const t of data.RelatedTopics ?? []) {
      if (hits.length >= maxResults) break;
      if (t.Text) {
        hits.push({ title: String(t.Text).slice(0, 60), url: t.FirstURL ?? '', snippet: t.Text });
      } else if (Array.isArray(t.Topics)) {
        for (const sub of t.Topics) {
          if (hits.length >= maxResults) break;
          hits.push({
            title: String(sub.Text ?? '').slice(0, 60),
            url: sub.FirstURL ?? '',
            snippet: sub.Text ?? '',
          });
        }
      }
    }
    return hits.slice(0, maxResults);
  } catch {
    return [];
  }
}
