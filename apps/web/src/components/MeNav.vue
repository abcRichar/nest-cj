<template>
  <div class="max-w-[1100px] mx-auto px-5 py-8">
    <div class="grid lg:grid-cols-[200px_1fr] gap-6">
      <!-- 侧边导航 -->
      <aside class="elp-card p-3 h-fit">
        <div class="flex items-center gap-3 px-3 py-4 mb-2">
          <el-avatar :size="44" :src="userStore.userInfo?.avatar || ''">
            {{ userStore.userInfo?.nickname?.[0] }}
          </el-avatar>
          <div class="min-w-0">
            <div class="font-medium text-ink-900 line-clamp-1">
              {{ userStore.userInfo?.nickname }}
            </div>
            <div class="text-xs text-ink-500 line-clamp-1">{{ userStore.userInfo?.email }}</div>
          </div>
        </div>

        <div
          v-for="m in menus"
          :key="m.path"
          class="px-3 py-2.5 rounded-lg cursor-pointer mb-1 text-sm flex items-center gap-2"
          :class="isActive(m.path) ? 'bg-brand-50 text-brand-600 font-medium' : 'text-ink-700 hover:bg-[#f7f9fc]'"
          @click="$router.push(m.path)"
        >
          <el-icon><component :is="m.icon" /></el-icon>{{ m.name }}
        </div>
      </aside>

      <section class="min-w-0">
        <router-view />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const userStore = useUserStore();

const menus = [
  { name: '个人资料', path: '/me', icon: 'User' },
  { name: '我的课程', path: '/me/courses', icon: 'Reading' },
  { name: '我的订单', path: '/me/orders', icon: 'Tickets' },
  { name: '学习日报', path: '/me/reports', icon: 'Document' },
];

const isActive = (p: string) => (p === '/me' ? route.path === '/me' : route.path.startsWith(p));
</script>
