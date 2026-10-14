import { get, post, del } from './http';
import type { FileObject, PageResult, UploadInitVo } from '@elp/shared';

export const initUpload = (data: {
  name: string;
  size: number;
  mimeType?: string;
  hash: string;
  totalChunks?: number;
}) => post<UploadInitVo & { fileId: number }>('/files/init', data);

export const uploadChunk = (fileId: number, index: number, data: string) =>
  post<{ uploaded: boolean; uploadedChunks: number[] }>(`/files/${fileId}/chunk`, { index, data });

export const completeUpload = (fileId: number) =>
  post<{ url: string; size?: number; instant: boolean }>(`/files/${fileId}/complete`);

export const uploadDirect = (formData: FormData) =>
  post<{ url: string; fileId: number; instant: boolean }>('/files/upload', formData);

export const myFiles = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  get<PageResult<FileObject>>('/files', params);

export const fileStats = () =>
  get<{ driver: string; bucket: string; fileCount: number; totalSize: number; todayCount: number }>(
    '/files/stats',
  );

export const deleteFile = (fileId: number) => del(`/files/${fileId}`);

/* ------------------------- 管理端 ------------------------- */

export const adminFiles = (params?: Record<string, any>) =>
  get<PageResult<FileObject & { user: any }>>('/admin/files', params);
export const adminFileStats = () => get<any>('/admin/files/stats');
export const adminDeleteFile = (id: number) => del(`/admin/files/${id}`);
