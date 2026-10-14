import { registerAs } from '@nestjs/config';

export const aiServiceConfig = registerAs('ai', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8090),
  apiPrefix: process.env.API_PREFIX ?? '/api',
  internalToken: process.env.INTERNAL_TOKEN ?? 'elp_internal_token',

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    temperature: Number(process.env.DEEPSEEK_TEMPERATURE ?? 0.7),
    maxTokens: Number(process.env.DEEPSEEK_MAX_TOKENS ?? 2048),
  },

  databaseUrl:
    process.env.DATABASE_URL ?? 'mysql://root:123456@127.0.0.1:3306/english_platform',

  search: {
    tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
    maxResults: Number(process.env.SEARCH_MAX_RESULTS ?? 5),
  },

  agent: {
    maxIterations: Number(process.env.AGENT_MAX_ITERATIONS ?? 8),
  },
}));

export function parseMysqlUrl(url: string) {
  // mysql://user:pass@host:port/db
  const m = /^mysql:\/\/([^:]+):([^@]*)@([^:/]+):?(\d+)?\/([^?]+)/.exec(url);
  if (!m) {
    return { host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'english_platform' };
  }
  return {
    user: decodeURIComponent(m[1]),
    password: decodeURIComponent(m[2]),
    host: m[3],
    port: Number(m[4] ?? 3306),
    database: m[5],
  };
}
