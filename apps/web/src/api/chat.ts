import { get, post, put, del } from './http';
import type { AiRole, ChatMessage, Conversation, PageResult } from '@elp/shared';

export const listRoles = () => get<AiRole[]>('/chat/roles');

export const listConversations = (params?: { page?: number; pageSize?: number }) =>
  get<PageResult<Conversation>>('/chat/conversations', params);

export const createConversation = (data: { roleId: number; title?: string }) =>
  post<Conversation>('/chat/conversations', data);

export const conversationDetail = (id: number) =>
  get<Conversation & { role: AiRole }>(`/chat/conversations/${id}`);

export const renameConversation = (id: number, title: string) =>
  put(`/chat/conversations/${id}`, { title });

export const deleteConversation = (id: number) => del(`/chat/conversations/${id}`);
export const clearConversations = () => del('/chat/conversations');

export const listMessages = (params: { conversationId: number; page?: number; pageSize?: number }) =>
  get<PageResult<ChatMessage>>('/chat/messages', params);

/* ------------------------- 管理端 ------------------------- */

export const adminAiRoles = () => get<Array<AiRole & { conversationCount: number }>>('/admin/ai-roles');
export const adminCreateAiRole = (data: Partial<AiRole>) => post('/admin/ai-roles', data);
export const adminUpdateAiRole = (id: number, data: Partial<AiRole>) =>
  put(`/admin/ai-roles/${id}`, data);
export const adminToggleAiRole = (id: number) => put(`/admin/ai-roles/${id}/toggle`);
export const adminDeleteAiRole = (id: number) => del(`/admin/ai-roles/${id}`);
export const adminConversations = (params: { page?: number; pageSize?: number }) =>
  get<PageResult<any>>('/admin/ai-roles/conversations', params);
