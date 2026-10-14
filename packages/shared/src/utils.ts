/**
 * 通用工具函数（前后端共用）
 */

import { BIZ, PAGE_DEFAULTS } from './constants';
import type { PageQuery } from './types';

/** 统一响应体构造 */
export function ok<T>(data: T, message = 'success') {
  return { code: 0, message, data, timestamp: Date.now() };
}

export function fail(message: string, code = 1) {
  return { code, message, data: null, timestamp: Date.now() };
}

/** 归一化分页参数 */
export function normalizePage(query: PageQuery = {}) {
  const page = Math.max(1, Number(query.page) || PAGE_DEFAULTS.PAGE);
  const pageSize = Math.min(
    PAGE_DEFAULTS.MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize) || PAGE_DEFAULTS.PAGE_SIZE),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** 金额格式化：分 -> 元 */
export function fen2yuan(fen: number): string {
  return (Math.round(fen) / 100).toFixed(2);
}

/** 金额格式化：元 -> 分 */
export function yuan2fen(yuan: number | string): number {
  return Math.round(Number(yuan) * 100);
}

/**
 * 艾宾浩斯遗忘曲线：根据连续答对次数计算下次复习间隔（天）
 */
export function calcReviewInterval(reviewCount: number): number {
  const list = BIZ.WORD_REVIEW_INTERVALS;
  const idx = Math.min(reviewCount, list.length - 1);
  return list[idx];
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化时长：秒 -> 1h 20m */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** 生成订单号：yyyyMMddHHmmss + 6 位随机 */
export function genOrderNo(prefix = 'ELP'): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const ts =
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  const rand = pad(Math.floor(Math.random() * 1_000_000), 6);
  return `${prefix}${ts}${rand}`;
}

/** 从原始文本中截取标题（用于会话自动命名） */
export function autoTitle(text: string, max = 20): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean || '新会话';
}
