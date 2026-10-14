<template>
  <div class="min-h-screen flex bg-[#f5f7fb]">
    <!-- 侧边栏 -->
    <aside
      class="bg-[#0f1b2d] text-white transition-all duration-200 flex flex-col shrink-0"
      :style="{ width: appStore.adminSidebarCollapsed ? '64px' : '220px' }"
    >
      <div class="h-16 flex items-center gap-2 px-4 border-b border-white/10 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center font-bold">
          L
        </div>
        <span v-show="!appStore.adminSidebarCollapsed" class="font-semibold tracking-tight">管理后台</span>
      </div>

      <el-scrollbar class="flex-1">
        <el-menu
          :default-active="route.path"
          :collapse="appStore.adminSidebarCollapsed"
          :collapse-transition="false"
          background-color="#0f1b2d"
          text-color="#c3ccdb"
          active-text-color="#ffffff"
          router
          class="!border-none"
        >
          <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
            <el-icon><component :is="m.icon" /></el-icon>
            <template #title>{{ m.name }}</template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>

      <div class="p-3 border-t border-white/10 text-xs text-white/50 shrink-0">
        <span v-show="!appStore.adminSidebarCollapsed">v1.0.0 · Monorepo</span>
      </div>
    </aside>

    <!-- 主区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 bg-white border-b border-[#e8ecf3] flex items-center px-5 gap-4 shrink-0">
        <el-icon class="cursor-pointer text-ink-700" :size="20" @click="appStore.toggleAdminSidebar()">
          <Fold v-if="!appStore.adminSidebarCollapsed" />
          <Expand v-else />
        </el-icon>

        <el-breadcrumb :separator-icon="ArrowRight">
          <el-breadcrumb-item :to="{ path: '/admin/dashboard' }">管理端</el-breadcrumb-item>
          <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
        </el-breadcrumb>

        <div class="ml-auto flex items-center gap-4">
          <el-tag v-if="health?.aiService" size="small" :type="health.aiService.up ? 'success' : 'danger'">
            AI 服务 {{ health.aiService.up ? '正常' : '离线' }}
          </el-tag>
          <span class="text-xs text-ink-500 hidden lg:inline">
            在线连接 {{ health?.socketOnline ?? 0 }}
          </span>
          <el-dropdown trigger="click" @command="onCommand">
            <div class="flex items-center gap-2 cursor-pointer">
              <el-avatar :size="30" :src="userStore.adminInfo?.avatar || ''">
                {{ userStore.adminInfo?.nickname?.[0] }}
              </el-avatar>
              <span class="text-sm text-ink-700">{{ userStore.adminInfo?.nickname }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="site"><el-icon><HomeFilled /></el-icon>返回前台</el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="flex-1 p-5 overflow-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';
import { adminHealth } from '@/api/admin';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const appStore = useAppStore();
const health = ref<any>(null);
let timer: number | undefined;

const menus = [
  { name: '数据看板', path: '/admin/dashboard', icon: 'DataLine' },
  { name: '用户管理', path: '/admin/users', icon: 'User' },
  { name: '课程管理', path: '/admin/courses', icon: 'Reading' },
  { name: '订单管理', path: '/admin/orders', icon: 'Tickets' },
  { name: 'AI 角色', path: '/admin/ai-roles', icon: 'ChatDotRound' },
  { name: '文件存储', path: '/admin/files', icon: 'FolderOpened' },
  { name: '学习日报', path: '/admin/reports', icon: 'Document' },
  { name: '公告管理', path: '/admin/notices', icon: 'Bell' },
];

function onCommand(cmd: string) {
  if (cmd === 'logout') {
    userStore.logout('admin');
    router.push('/admin/login');
  } else if (cmd === 'site') {
    router.push('/');
  }
}

async function loadHealth() {
  try {
    health.value = await adminHealth();
  } catch {
    /* 忽略 */
  }
}

onMounted(() => {
  loadHealth();
  timer = window.setInterval(loadHealth, 30000);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
:deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, #2f74ff 0%, #1656f0 100%) !important;
}
</style>
