import dayjs from 'dayjs';

/** 分 -> 元 */
export function fen2yuan(fen: number | null | undefined): string {
  return ((Number(fen) || 0) / 100).toFixed(2);
}

/** 秒 -> 可读时长 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} 小时 ${m} 分`;
  if (m) return `${m} 分钟`;
  return `${s} 秒`;
}

export function formatDate(d?: string | number | Date, fmt = 'YYYY-MM-DD HH:mm') {
  if (!d) return '-';
  return dayjs(d).format(fmt);
}

export function fromNow(d?: string | number | Date) {
  if (!d) return '-';
  const diff = Date.now() - dayjs(d).valueOf();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return dayjs(d).format('YYYY-MM-DD');
}

export const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: '入门',
  INTERMEDIATE: '进阶',
  ADVANCED: '高级',
};

export const ORDER_STATUS_LABEL: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待支付', type: 'warning' },
  PAID: { text: '已支付', type: 'success' },
  CANCELLED: { text: '已取消', type: 'info' },
  REFUNDED: { text: '已退款', type: 'danger' },
};

export const WORD_STATUS_LABEL: Record<string, { text: string; type: string }> = {
  NEW: { text: '未学习', type: 'info' },
  LEARNING: { text: '学习中', type: 'warning' },
  MASTERED: { text: '已掌握', type: 'success' },
};

/** 极简 Markdown 渲染（粗体 / 行内代码 / 代码块 / 列表 / 换行） */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code}</code></pre>`);
  // 行内代码
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 标题
  html = html.replace(/^###\s?(.*)$/gm, '<strong>$1</strong>');
  html = html.replace(/^##\s?(.*)$/gm, '<strong>$1</strong>');
  // 无序列表
  html = html.replace(/^(?:[-*])\s?(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  // 段落
  html = html
    .split(/\n{2,}/)
    .map((p) => (p.startsWith('<') ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`))
    .join('');
  return html;
}
