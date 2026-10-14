<template>
  <router-view v-slot="{ Component }">
    <transition name="fade-slide" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { useSocket } from '@/utils/socket';

const userStore = useUserStore();
const socket = useSocket();

onMounted(() => {
  userStore.restore();
  if (userStore.token) socket.connect(userStore.token);
});

// 登录态变化时同步 WebSocket 连接
watch(
  () => userStore.token,
  (token) => {
    if (token) socket.connect(token);
    else socket.disconnect();
  },
);
</script>
