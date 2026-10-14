import { get, post, put } from './http';
import type { LoginDto, LoginVo, RegisterDto, User } from '@elp/shared';

export const login = (data: LoginDto) => post<LoginVo>('/auth/login', data);
export const register = (data: RegisterDto) => post<LoginVo>('/auth/register', data);
export const profile = () => get<User & { courseCount: number; wordCount: number }>('/auth/profile');
export const updateProfile = (data: Partial<User>) => put<User>('/auth/profile', data);
export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  put<{ success: boolean }>('/auth/password', data);
export const logout = () => post('/auth/logout');

export const adminLogin = (data: LoginDto) => post<LoginVo>('/admin/auth/login', data);
export const adminProfile = () => get<User>('/admin/auth/profile');
