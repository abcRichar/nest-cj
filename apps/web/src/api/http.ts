import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import { safeHmac } from './sign';

const SIGN_KEY = import.meta.env.VITE_SIGN_KEY || 'elp_client_sign_key_dev';

/** 需要签名校验的关键接口路径（与后端 @SignedApi() 一一对应） */
const SIGNED_PATHS = ['/auth/password', '/orders'];

function needSign(url = '', method = 'get') {
  const m = method.toLowerCase();
  if (!['post', 'put', 'patch', 'delete'].includes(m)) return false;
  return SIGNED_PATHS.some((p) => url.startsWith(p));
}

function nonce() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export interface ApiResult<T = any> {
  code: number;
  message: string;
  data: T;
}

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/* ------------------------- 请求拦截 ------------------------- */

http.interceptors.request.use(async (config) => {
  const url = config.url ?? '';
  const method = config.method ?? 'get';

  // 双端会话：管理端接口必须带管理端 token，否则会被后端 AuthScope 判为越权（401）
  const isAdminApi = url.startsWith('/admin');
  const token = localStorage.getItem(isAdminApi ? 'elp_admin_token' : 'elp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (needSign(url, method) && method !== 'get') {
    const ts = Date.now();
    const n = nonce();
    const body = config.data ? JSON.stringify(config.data) : '';
    const fullPath = `${import.meta.env.VITE_API_BASE || '/api'}${url}`;
    const raw = `${method.toUpperCase()}\n${fullPath}\n${ts}\n${n}\n${body}`;
    const sign = await safeHmac(raw, SIGN_KEY);

    config.headers['x-sign'] = sign;
    config.headers['x-timestamp'] = String(ts);
    config.headers['x-nonce'] = n;
  }

  return config;
});

/* ------------------------- 响应拦截 ------------------------- */

http.interceptors.response.use(
  (res) => {
    // 二进制/文本流直接返回
    if (res.config.responseType === 'blob' || res.config.responseType === 'text') return res;

    const body = res.data as ApiResult;
    if (body && typeof body.code === 'number' && body.code !== 0) {
      ElMessage.error(body.message || '请求失败');
      return Promise.reject(body);
    }
    return res;
  },
  async (error) => {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message || error.message || '网络异常';

    if (status === 401) {
      ElMessage.error('登录已过期，请重新登录');
      // 按失败请求所属端清理对应会话，避免管理端 401 把用户端登录态一起清掉
      const reqUrl = String(error?.config?.url ?? '');
      const isAdminReq = reqUrl.startsWith('/admin') || location.pathname.startsWith('/admin');
      localStorage.removeItem(isAdminReq ? 'elp_admin_token' : 'elp_token');
      localStorage.removeItem(isAdminReq ? 'elp_admin_user' : 'elp_user');
      setTimeout(() => {
        location.href = isAdminReq ? '/admin/login' : '/login';
      }, 600);
    } else if (status === 403) {
      ElMessage.error(msg || '权限不足');
    } else if (status === 400 || status === 404 || status === 409) {
      ElMessage.error(msg);
    } else {
      ElMessage.error(msg);
    }
    return Promise.reject(error);
  },
);

/** 统一取 data 层 */
export async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<ApiResult<T>>(config);
  return res.data.data;
}

export const get = <T = any>(url: string, params?: any) => request<T>({ url, method: 'get', params });
export const post = <T = any>(url: string, data?: any) => request<T>({ url, method: 'post', data });
export const put = <T = any>(url: string, data?: any) => request<T>({ url, method: 'put', data });
export const patch = <T = any>(url: string, data?: any) => request<T>({ url, method: 'patch', data });
export const del = <T = any>(url: string, params?: any) => request<T>({ url, method: 'delete', params });

export default http;
