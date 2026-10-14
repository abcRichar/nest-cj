<template>
  <div v-loading="loading">
    <!-- 指标卡 -->
    <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
      <div v-for="c in cards" :key="c.label" class="elp-card p-5">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs text-ink-500 mb-2">{{ c.label }}</div>
            <div class="text-2xl font-bold text-ink-900">{{ c.value }}</div>
            <div class="text-xs mt-1" :class="c.subColor">{{ c.sub }}</div>
          </div>
          <div class="w-10 h-10 rounded-xl grid place-items-center" :style="{ background: c.bg, color: c.color }">
            <el-icon :size="19"><component :is="c.icon" /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <div class="grid xl:grid-cols-[1fr_400px] gap-5 mb-5">
      <!-- 趋势 -->
      <div class="elp-card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="elp-section-title">近 14 天收入 / 订单趋势</h3>
          <el-radio-group v-model="trendMetric" size="small">
            <el-radio-button label="revenue">收入</el-radio-button>
            <el-radio-button label="orders">订单</el-radio-button>
            <el-radio-button label="newUsers">新增用户</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendRef" class="h-[300px]"></div>
      </div>

      <!-- 热销课程 -->
      <div class="elp-card p-5">
        <h3 class="elp-section-title mb-4">热销课程 TOP5</h3>
        <div class="space-y-3">
          <div v-for="(c, i) in stat?.hotCourses ?? []" :key="c.courseId" class="flex items-center gap-3">
            <span
              class="w-6 h-6 rounded-md text-xs grid place-items-center font-bold"
              :class="i < 3 ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500'"
            >
              {{ i + 1 }}
            </span>
            <span class="text-sm text-ink-900 flex-1 line-clamp-1">{{ c.title }}</span>
            <span class="text-xs text-ink-500">{{ c.sales }} 单</span>
            <span class="text-xs text-[#f56c6c] font-medium">¥{{ fen2yuan(c.revenue ?? 0) }}</span>
          </div>
          <el-empty v-if="!stat?.hotCourses?.length" :image-size="70" description="暂无成交数据" />
        </div>

        <el-divider />

        <h3 class="elp-section-title mb-4">系统状态</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-ink-500">数据库</span>
            <el-tag size="small" :type="health?.database === 'UP' ? 'success' : 'danger'">{{ health?.database ?? '-' }}</el-tag>
          </div>
          <div class="flex justify-between"><span class="text-ink-500">AI 服务</span>
            <el-tag size="small" :type="health?.aiService?.up ? 'success' : 'danger'">
              {{ health?.aiService?.up ? `正常 (${health.aiService.llm})` : '离线' }}
            </el-tag>
          </div>
          <div class="flex justify-between"><span class="text-ink-500">在线连接</span>
            <span class="text-ink-900">{{ health?.socketOnline ?? 0 }}</span>
          </div>
          <div class="flex justify-between"><span class="text-ink-500">运行时长</span>
            <span class="text-ink-900">{{ formatUptime(health?.uptime ?? 0) }}</span>
          </div>
          <div class="flex justify-between"><span class="text-ink-500">Node 版本</span>
            <span class="text-ink-900">{{ health?.node ?? '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 注册趋势 -->
    <div class="elp-card p-5">
      <h3 class="elp-section-title mb-4">用户注册趋势</h3>
      <div ref="registerRef" class="h-[240px]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { adminDashboard, adminHealth, adminRegisterTrend } from '@/api/admin';
import { fen2yuan } from '@/utils/format';

const stat = ref<any>(null);
const health = ref<any>(null);
const registerTrend = ref<any[]>([]);
const loading = ref(true);
const trendMetric = ref<'revenue' | 'orders' | 'newUsers'>('revenue');

const trendRef = ref<HTMLElement | null>(null);
const registerRef = ref<HTMLElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let registerChart: echarts.ECharts | null = null;
let timer: number | undefined;

const cards = computed(() => {
  const s = stat.value ?? {};
  return [
    {
      label: '用户总数',
      value: s.userTotal ?? 0,
      sub: `今日新增 ${s.userTodayNew ?? 0}`,
      subColor: 'text-[#22a06b]',
      icon: 'User',
      bg: '#eef5ff',
      color: '#2f74ff',
    },
    {
      label: '订单总数',
      value: s.orderTotal ?? 0,
      sub: `今日 ${s.orderTodayCount ?? 0} 单`,
      subColor: 'text-[#2f74ff]',
      icon: 'Tickets',
      bg: '#fff7e6',
      color: '#e6a23c',
    },
    {
      label: '累计收入',
      value: `¥${fen2yuan(s.revenueTotal ?? 0)}`,
      sub: `今日 ¥${fen2yuan(s.revenueToday ?? 0)}`,
      subColor: 'text-[#f56c6c]',
      icon: 'Money',
      bg: '#f2fff6',
      color: '#22a06b',
    },
    {
      label: '7 日活跃用户',
      value: s.activeUser7d ?? 0,
      sub: `课程 ${s.courseTotal ?? 0} 门`,
      subColor: 'text-ink-500',
      icon: 'TrendCharts',
      bg: '#f6f2ff',
      color: '#7c5cff',
    },
  ];
});

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function renderTrend() {
  if (!trendRef.value || !stat.value) return;
  trendChart = echarts.init(trendRef.value);
  const data = stat.value.trend ?? [];
  const metric = trendMetric.value;

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 20, top: 20, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.map((d: any) => d.date),
      axisLine: { lineStyle: { color: '#e8ecf3' } },
      axisLabel: { color: '#6b7688', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0f3f8' } },
      axisLabel: {
        color: '#6b7688',
        fontSize: 11,
        formatter: (v: number) => (metric === 'revenue' ? `¥${(v / 100).toFixed(0)}` : v),
      },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: data.map((d: any) => d[metric]),
        itemStyle: { color: metric === 'revenue' ? '#f56c6c' : '#2f74ff' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: metric === 'revenue' ? 'rgba(245,108,108,0.25)' : 'rgba(47,116,255,0.25)' },
            { offset: 1, color: 'rgba(255,255,255,0)' },
          ]),
        },
      },
    ],
  });
}

function renderRegister() {
  if (!registerRef.value) return;
  registerChart = echarts.init(registerRef.value);
  registerChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 32 },
    xAxis: {
      type: 'category',
      data: registerTrend.value.map((d) => d.date),
      axisLine: { lineStyle: { color: '#e8ecf3' } },
      axisLabel: { color: '#6b7688', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0f3f8' } },
      axisLabel: { color: '#6b7688', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        data: registerTrend.value.map((d) => d.count),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#5a99ff' },
            { offset: 1, color: '#1656f0' },
          ]),
        },
      },
    ],
  });
}

function resize() {
  trendChart?.resize();
  registerChart?.resize();
}

async function loadHealth() {
  health.value = await adminHealth().catch(() => null);
}

onMounted(async () => {
  try {
    const [s, rt] = await Promise.all([adminDashboard(), adminRegisterTrend(14)]);
    stat.value = s;
    registerTrend.value = rt;
    renderTrend();
    renderRegister();
  } finally {
    loading.value = false;
  }

  await loadHealth();
  timer = window.setInterval(loadHealth, 30000);
  window.addEventListener('resize', resize);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
  window.removeEventListener('resize', resize);
  trendChart?.dispose();
  registerChart?.dispose();
});

watch(trendMetric, () => renderTrend());
</script>
