import { get, post } from './http';
import type { Order, PageResult } from '@elp/shared';

export const createOrder = (data: { courseId: number; payType?: string }) =>
  post<Order>('/orders', data);

export const listOrders = (params: { page?: number; pageSize?: number; status?: string }) =>
  get<PageResult<Order>>('/orders', params);

export const orderDetail = (orderNo: string) => get<Order>(`/orders/${orderNo}`);

export const getPayForm = (orderNo: string) =>
  post<{ orderNo: string; payForm: string; amount: number; mock: boolean }>(
    `/orders/${orderNo}/pay`,
  );

export const syncOrder = (orderNo: string) => post<Order>(`/orders/${orderNo}/sync`);
export const cancelOrder = (orderNo: string) => post(`/orders/${orderNo}/cancel`);

/* ------------------------- 管理端 ------------------------- */

export const adminOrders = (params: Record<string, any>) =>
  get<PageResult<Order & { user: any }>>('/admin/orders', params);

export const adminRefund = (orderNo: string) => post(`/admin/orders/${orderNo}/refund`);
