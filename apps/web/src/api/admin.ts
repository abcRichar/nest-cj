import { get, post, put, patch, del } from './http';
import type { DashboardStat, PageResult, User } from '@elp/shared';

/* ------------------------- 看板 ------------------------- */

export const adminDashboard = () => get<DashboardStat & { onlineCount: number; unreadReports: number }>('/admin/dashboard');
export const adminHealth = () => get<any>('/admin/health');
export const adminRegisterTrend = (days = 14) =>
  get<Array<{ date: string; count: number }>>('/admin/dashboard/register-trend', { days });

/* ------------------------- 用户 ------------------------- */

export const adminUsers = (params: Record<string, any>) =>
  get<PageResult<User & { orderCount: number; courseCount: number }>>('/admin/users', params);

export const adminUserDetail = (id: number) => get<any>(`/admin/users/${id}`);
export const adminUpdateUser = (id: number, data: Record<string, any>) => put(`/admin/users/${id}`, data);
export const adminUpdateUserStatus = (id: number, status: string) =>
  patch(`/admin/users/${id}/status`, { status });
export const adminResetPassword = (id: number, password: string) =>
  patch(`/admin/users/${id}/password`, { password });
export const adminDeleteUser = (id: number) => del(`/admin/users/${id}`);

/* ------------------------- 公告 ------------------------- */

export const adminNotices = (params?: { page?: number; pageSize?: number }) =>
  get<PageResult<any>>('/admin/notices', params);
export const adminCreateNotice = (data: { title: string; content: string; type?: string }) =>
  post('/admin/notices', data);
export const adminUpdateNotice = (id: number, data: Record<string, any>) => put(`/admin/notices/${id}`, data);
export const adminDeleteNotice = (id: number) => del(`/admin/notices/${id}`);

/* ------------------------- 日报 ------------------------- */

export const adminReports = (params?: { page?: number; pageSize?: number }) =>
  get<PageResult<any>>('/admin/reports', params);
export const adminTriggerReports = (date?: string) => post('/admin/reports/trigger', { date });

/* ------------------------- 公共 ------------------------- */

export const publicNotices = (limit = 5) => get<any[]>('/notices', { limit });
export const mineSummary = () =>
  get<{ dueWords: number; pendingOrders: number; unreadNotices: number; latestReport: any }>(
    '/notices/mine/summary',
  );
