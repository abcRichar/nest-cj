<template>
  <div class="min-h-screen flex flex-col bg-[#f5f7fb]">
    <!-- 顶部导航 -->
    <header
      class="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-[#e8ecf3]"
    >
      <div class="max-w-[1200px] mx-auto h-16 px-5 flex items-center gap-8">
        <router-link to="/" class="flex items-center gap-2 shrink-0">
          <div
            class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white grid place-items-center font-bold text-lg"
          >
            L
          </div>
          <span class="text-lg font-bold tracking-tight text-ink-900">LinguaFlow</span>
        </router-link>

        <nav class="hidden md:flex items-center gap-1 flex-1">
          <router-link
            v-for="item in navs"
            :key="item.path"
            :to="item.path"
            class="px-4 py-2 rounded-lg text-sm transition-colors"
            :class="
              isActive(item.path)
                ? 'text-brand-600 bg-brand-50 font-medium'
                : 'text-ink-700 hover:text-brand-600 hover:bg-brand-50/60'
            "
          >
            {{ item.name }}
          </router-link>
        </nav>

        <div class="flex items-center gap-3 ml-auto">
          <el-badge :value="appStore.unread" :hidden="!appStore.unread" class="cursor-pointer">
            <el-icon :size="19" class="text-ink-700 hover:text-brand-600" @click="showNotices">
              <Bell />
            </el-icon>
          </el-badge>

          <template v-if="userStore.isLogin">
            <el-dropdown trigger="click" @command="onCommand">
              <div class="flex items-center gap-2 cursor-pointer pl-2">
                <el-avatar :size="32" :src="userStore.userInfo?.avatar || ''">
                  {{ userStore.userInfo?.nickname?.[0] }}
                </el-avatar>
                <span class="text-sm text-ink-700 hidden sm:inline">
                  {{ userStore.userInfo?.nickname }}
                </span>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="me"><el-icon><User /></el-icon>个人中心</el-dropdown-item>
                  <el-dropdown-item command="courses">
                    <el-icon><Reading /></el-icon>我的课程
                  </el-dropdown-item>
                  <el-dropdown-item command="orders">
                    <el-icon><Tickets /></el-icon>我的订单
                  </el-dropdown-item>
                  <el-dropdown-item command="reports">
                    <el-icon><Document /></el-icon>学习日报
                  </el-dropdown-item>
                  <el-dropdown-item v-if="userStore.isAdmin" command="admin" divided>
                    <el-icon><Setting /></el-icon>进入管理端
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided>
                    <el-icon><SwitchButton /></el-icon>退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button text @click="$router.push('/login')">登录</el-button>
            <el-button type="primary" round @click="$router.push('/register')">免费注册</el-button>
          </template>
        </div>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-[#e8ecf3] bg-white mt-12">
      <div class="max-w-[1200px] mx-auto px-5 py-7 text-sm text-ink-500 flex flex-wrap gap-3 justify-between">
        <span>© {{ year }} LinguaFlow · Monorepo 全栈英语学习平台</span>
        <span class="flex items-center gap-4">
          <span>Vue3 · Element Plus · TailwindCSS</span>
          <span>NestJS · Prisma · LangGraph</span>
        </span>
      </div>
    </footer>

    <!-- 公告抽屉 -->
    <el-drawer v-model="noticeVisible" title="通知公告" size="420px">
      <div v-if="!appStore.notices.length" class="text-center text-ink-500 py-16">暂无公告</div>
      <div v-for="n in appStore.notices" :key="n.id" class="mb-4 p-4 rounded-xl2 bg-[#f7f9fc]">
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium text-ink-900">{{ n.title }}</span>
          <el-tag size="small" :type="noticeType(n.type)">{{ n.type }}</el-tag>
        </div>
        <div class="text-sm text-ink-500 whitespace-pre-wrap">{{ n.content }}</div>
        <div class="text-xs text-ink-500 mt-2">{{ formatDate(n.createdAt) }}</div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';
import { publicNotices, mineSummary } from '@/api/admin';
import { useSocket } from '@/utils/socket';
import { formatDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const appStore = useAppStore();
const socket = useSocket();
const year = new Date().getFullYear();
const noticeVisible = ref(false);

const navs = [
  { name: '首页', path: '/' },
  { name: '课程中心', path: '/courses' },
  { name: '单词本', path: '/words' },
  { name: 'AI 对话', path: '/chat' },
  { name: '学习中心', path: '/me' },
];

const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path));

function noticeType(type: string) {
  return type === 'ACTIVITY' ? 'warning' : type === 'COURSE' ? 'success' : 'info';
}

async function showNotices() {
  noticeVisible.value = true;
  if (!appStore.notices.length) {
    appStore.notices = await publicNotices(20);
  }
  appStore.unread = 0;
}

function onCommand(cmd: string) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
      .then(() => {
        userStore.logout('user');
        socket.disconnect();
        router.push('/login');
      })
      .catch(() => void 0);
    return;
  }
  if (cmd === 'admin') {
    router.push('/admin');
    return;
  }
  router.push(cmd === 'me' ? '/me' : `/me/${cmd}`);
}

onMounted(async () => {
  try {
    appStore.notices = await publicNotices(10);
  } catch {
    /* 忽略首页公告加载失败 */
  }
  if (userStore.isLogin) {
    mineSummary()
      .then((s) => {
        appStore.unread = s.unreadNotices;
      })
      .catch(() => void 0);
  }
});

const unreadBadge = computed(() => appStore.unread);
</script>
