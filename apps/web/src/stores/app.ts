import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false,
    adminSidebarCollapsed: false,
    notices: [] as Array<{ id: number; title: string; content: string; type: string; createdAt: string }>,
    unread: 0,
    /** AI 服务是否可用（登录后探活） */
    aiOnline: true as boolean | null,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    toggleAdminSidebar() {
      this.adminSidebarCollapsed = !this.adminSidebarCollapsed;
    },
  },
});
