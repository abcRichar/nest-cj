import { defineStore } from 'pinia';
import type { User } from '@elp/shared';
import * as authApi from '@/api/auth';

type Scope = 'user' | 'admin';

const KEYS: Record<Scope, { token: string; user: string }> = {
  user: { token: 'elp_token', user: 'elp_user' },
  admin: { token: 'elp_admin_token', user: 'elp_admin_user' },
};

interface State {
  userToken: string;
  userInfo: User | null;
  adminToken: string;
  adminInfo: User | null;
}

export const useUserStore = defineStore('user', {
  state: (): State => ({
    userToken: '',
    userInfo: null,
    adminToken: '',
    adminInfo: null,
  }),

  getters: {
    /** 兼容：默认取用户端 */
    token: (s) => s.userToken,
    info: (s) => s.userInfo,
    isLogin: (s) => Boolean(s.userToken),
    isAdminLogin: (s) => Boolean(s.adminToken),
    isAdmin: (s) => s.userInfo?.role === 'ADMIN' || s.adminInfo?.role === 'ADMIN',
  },

  actions: {
    /* ------------------------- 用户端 ------------------------- */

    async login(account: string, password: string) {
      const res = await authApi.login({ account, password });
      this.setSession('user', res.token, res.user);
      return res;
    },

    async register(payload: { username: string; email: string; password: string; nickname?: string }) {
      const res = await authApi.register(payload);
      this.setSession('user', res.token, res.user);
      return res;
    },

    async fetchProfile() {
      const user = await authApi.profile();
      this.userInfo = user as User;
      localStorage.setItem(KEYS.user.user, JSON.stringify(user));
      return user;
    },

    /* ------------------------- 管理端 ------------------------- */

    async adminLogin(account: string, password: string) {
      const res = await authApi.adminLogin({ account, password });
      this.setSession('admin', res.token, res.user);
      return res;
    },

    async fetchAdminProfile() {
      const user = await authApi.adminProfile();
      this.adminInfo = user as User;
      localStorage.setItem(KEYS.admin.user, JSON.stringify(user));
      return user;
    },

    /* ------------------------- 通用 ------------------------- */

    setSession(scope: Scope, token: string, user: User) {
      const k = KEYS[scope];
      localStorage.setItem(k.token, token);
      localStorage.setItem(k.user, JSON.stringify(user));
      if (scope === 'user') {
        this.userToken = token;
        this.userInfo = user;
      } else {
        this.adminToken = token;
        this.adminInfo = user;
      }
    },

    restore() {
      for (const scope of ['user', 'admin'] as Scope[]) {
        const k = KEYS[scope];
        const token = localStorage.getItem(k.token) ?? '';
        const raw = localStorage.getItem(k.user);
        const user = raw ? (JSON.parse(raw) as User) : null;
        if (scope === 'user') {
          this.userToken = token;
          this.userInfo = user;
        } else {
          this.adminToken = token;
          this.adminInfo = user;
        }
      }
    },

    logout(scope: Scope = 'user') {
      const k = KEYS[scope];
      localStorage.removeItem(k.token);
      localStorage.removeItem(k.user);
      if (scope === 'user') {
        this.userToken = '';
        this.userInfo = null;
      } else {
        this.adminToken = '';
        this.adminInfo = null;
      }
    },
  },
});
