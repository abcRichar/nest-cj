<template>
  <div class="min-h-[70vh] grid place-items-center px-5">
    <div class="elp-card p-10 text-center max-w-[520px] w-full">
      <template v-if="loading">
        <el-icon :size="44" class="animate-spin text-brand-500 mb-4"><Loading /></el-icon>
        <p class="text-ink-500">正在确认支付结果…</p>
      </template>

      <template v-else-if="order?.status === 'PAID'">
        <el-icon :size="56" color="#22a06b" class="mb-4"><CircleCheckFilled /></el-icon>
        <h2 class="text-xl font-bold text-ink-900 mb-2">支付成功</h2>
        <p class="text-sm text-ink-500 mb-1">订单号：{{ order.orderNo }}</p>
        <p class="text-sm text-ink-500 mb-6">
          实付金额：
          <span class="text-[#f56c6c] font-semibold">¥{{ fen2yuan(order.amount) }}</span>
        </p>
        <div class="flex gap-3 justify-center">
          <el-button type="primary" @click="$router.push(`/study/${order.courseId}`)">立即开始学习</el-button>
          <el-button @click="$router.push('/me/courses')">我的课程</el-button>
        </div>
      </template>

      <template v-else-if="order">
        <el-icon :size="56" color="#e6a23c" class="mb-4"><WarningFilled /></el-icon>
        <h2 class="text-xl font-bold text-ink-900 mb-2">
          {{ ORDER_STATUS_LABEL[order.status]?.text ?? '订单状态异常' }}
        </h2>
        <p class="text-sm text-ink-500 mb-6">订单号：{{ order.orderNo }}</p>
        <div class="flex gap-3 justify-center">
          <el-button @click="refresh" :loading="loading">重新查询</el-button>
          <el-button type="primary" @click="$router.push('/me/orders')">查看订单</el-button>
        </div>
      </template>

      <template v-else>
        <el-icon :size="56" color="#f56c6c" class="mb-4"><CircleCloseFilled /></el-icon>
        <h2 class="text-xl font-bold text-ink-900 mb-2">未找到订单</h2>
        <p class="text-sm text-ink-500 mb-6">请检查订单号是否正确</p>
        <el-button type="primary" @click="$router.push('/me/orders')">查看我的订单</el-button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { syncOrder } from '@/api/order';
import { fen2yuan, ORDER_STATUS_LABEL } from '@/utils/format';
import type { Order } from '@elp/shared';

const route = useRoute();
const order = ref<Order | null>(null);
const loading = ref(true);
let tries = 0;

async function refresh() {
  const orderNo = route.query.orderNo as string;
  if (!orderNo) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    order.value = await syncOrder(orderNo);
  } catch {
    order.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await refresh();
  // 异步通知可能比同步跳转稍晚，轮询几次兜底
  const timer = setInterval(async () => {
    tries += 1;
    if (order.value?.status === 'PAID' || tries >= 5) {
      clearInterval(timer);
      return;
    }
    await refresh();
  }, 2500);
});
</script>
