import { get, post, put, del } from './http';
import type { PageResult, Word, WordBook, WordReviewResult } from '@elp/shared';

/* ------------------------- 单词本 ------------------------- */

export const listWordBooks = () => get<WordBook[]>('/words/books');
export const createWordBook = (data: { name: string; description?: string }) =>
  post<WordBook>('/words/books', data);
export const updateWordBook = (id: number, data: { name: string; description?: string }) =>
  put(`/words/books/${id}`, data);
export const deleteWordBook = (id: number) => del(`/words/books/${id}`);

/* ------------------------- 单词 ------------------------- */

export const listWords = (params: {
  bookId?: number;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) => get<PageResult<Word>>('/words', params);

export const wordStats = () =>
  get<{
    total: number;
    new: number;
    learning: number;
    mastered: number;
    due: number;
    todayReviewed: number;
    masteryRate: number;
  }>('/words/stats');

export const createWord = (data: Partial<Word>) => post<Word>('/words', data);
export const updateWord = (id: number, data: Partial<Word>) => put<Word>(`/words/${id}`, data);
export const deleteWord = (id: number) => del(`/words/${id}`);
export const batchDeleteWords = (ids: number[]) => post('/words/batch-delete', { ids });

export const importWords = (data: { bookId: number; words: any[] }) =>
  post<{ imported: number; skipped: number }>('/words/import', data);

/* ------------------------- 复习 ------------------------- */

export const todayQueue = (limit = 20) => get<{ total: number; list: Word[] }>('/words/review/today', { limit });
export const reviewWord = (data: { wordId: number; correct: boolean; cost?: number }) =>
  post<WordReviewResult>('/words/review', data);
export const batchReview = (items: Array<{ wordId: number; correct: boolean; cost?: number }>) =>
  post('/words/review/batch', { items });
