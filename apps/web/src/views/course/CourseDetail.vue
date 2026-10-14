<template>
  <div v-loading="loading" class="max-w-[1100px] mx-auto px-5 py-8">
    <template v-if="course">
      <!-- 头部 -->
      <div class="elp-card p-6 mb-6 flex flex-col md:flex-row gap-6">
        <div class="w-full md:w-[320px] h-[186px] rounded-xl2 overflow-hidden bg-ink-100 shrink-0">
          <img v-if="course.cover" :src="course.cover" class="w-full h-full object-cover" :alt="course.title" />
          <div v-else class="w-full h-full grid place-items-center bg-gradient-to-br from-brand-400 to-brand-700 text-white text-5xl font-bold">
            {{ course.title[0] }}
          </div>
        </div>

        <div class="flex-1 flex flex-col">
          <div class="flex items-center gap-2 mb-2">
            <el-tag size="small" type="success">{{ LEVEL_LABEL[course.level] }}</el-tag>
            <el-tag v-if="course.categoryName" size="small" type="info">{{ course.categoryName }}</el-tag>
          </div>

          <h1 class="text-xl lg:text-2xl font-bold text-ink-900 mb-2">{{ course.title }}</h1>
          <p class="text-sm text-ink-500 mb-4">{{ course.subtitle }}</p>

          <div class="flex flex-wrap gap-5 text-sm text-ink-500 mb-4">
            <span class="flex items-center gap-1"><el-icon><User /></el-icon>{{ course.teacher || '平台讲师' }}</span>
            <span class="flex items-center gap-1"><el-icon><VideoPlay /></el-icon>{{ course.lessonCount }} 课时</span>
            <span class="flex items-center gap-1"><el-icon><Clock /></el-icon>{{ formatDuration(course.duration) }}</span>
            <span class="flex items-center gap-1"><el-icon><UserFilled /></el-icon>{{ course.studentCount }} 人在学</span>
            <span class="flex items-center gap-1"><el-icon color="#e6a23c"><StarFilled /></el-icon>{{ course.rating }}</span>
          </div>

          <div v-if="course.tags?.length" class="flex flex-wrap gap-2 mb-5">
            <el-tag v-for="t in course.tags" :key="t" size="small" effect="plain">{{ t }}</el-tag>
          </div>

          <div class="mt-auto flex items-end gap-5">
            <div>
              <span class="text-3xl font-bold text-[#f56c6c]">¥{{ fen2yuan(course.price) }}</span>
              <span v-if="course.originalPrice" class="text-sm text-ink-500 line-through ml-2">
                ¥{{ fen2yuan(course.originalPrice) }}
              </span>
            </div>

            <div class="ml-auto flex gap-3">
              <template v-if="course.purchased">
                <el-button type="primary" size="large" round @click="$router.push(`/study/${course.id}`)">
                  继续学习（{{ course.progress }}%）
                </el-button>
              </template>
              <template v-else>
                <el-button type="primary" size="large" round :loading="paying" @click="buy">
                  立即购买
                </el-button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-[1fr_320px] gap-6">
        <!-- 课程目录 -->
        <div class="elp-card p-6">
          <h2 class="elp-section-title mb-5">课程目录</h2>
          <el-collapse v-model="activeChapters">
            <el-collapse-item
              v-for="(ch, ci) in course.chapters"
              :key="ch.id"
              :name="ch.id"
            >
              <template #title>
                <div class="flex items-center gap-3">
                  <span class="w-6 h-6 rounded-md bg-brand-50 text-brand-600 text-xs grid place-items-center font-medium">
                    {{ ci + 1 }}
                  </span>
                  <span class="font-medium text-ink-900">{{ ch.title }}</span>
                  <span class="text-xs text-ink-500">{{ ch.lessons?.length ?? 0 }} 节</span>
                </div>
              </template>

              <div
                v-for="ls in ch.lessons"
                :key="ls.id"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f7f9fc] cursor-pointer"
                @click="playLesson(ls)"
              >
                <el-icon :size="16" class="text-ink-500">
                  <VideoPlay v-if="canPlay(ls)" />
                  <Lock v-else />
                </el-icon>
                <span class="text-sm text-ink-700 flex-1">{{ ls.title }}</span>
                <el-tag v-if="ls.isFree" size="small" type="success" effect="plain">试看</el-tag>
                <span class="text-xs text-ink-500">{{ Math.round(ls.duration / 60) }} 分钟</span>
              </div>
              <el-empty v-if="!ch.lessons?.length" :image-size="60" description="该章节暂无课时" />
            </el-collapse-item>
          </el-collapse>
          <el-empty v-if="!course.chapters?.length" description="课程目录待完善" />
        </div>

        <!-- 课程介绍 -->
        <div class="elp-card p-6 h-fit">
          <h2 class="elp-section-title mb-4">课程介绍</h2>
          <div class="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
            {{ course.description || '暂无详细介绍' }}
          </div>

          <el-divider />

          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-ink-500">课程难度</span>
              <span class="text-ink-900">{{ LEVEL_LABEL[course.level] }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">总时长</span>
              <span class="text-ink-900">{{ formatDuration(course.duration) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">更新时间</span>
              <span class="text-ink-900">{{ formatDate(course.createdAt, 'YYYY-MM-DD') }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 支付中弹窗 -->
    <el-dialog v-model="payVisible" title="订单支付" width="440px" :close-on-click-modal="false">
      <div v-if="payInfo" class="text-center">
        <div class="text-sm text-ink-500 mb-1">订单号</div>
        <div class="text-xs text-ink-700 mb-4 break-all">{{ payInfo.orderNo }}</div>
        <div class="text-2xl font-bold text-[#f56c6c] mb-4">¥{{ fen2yuan(payInfo.amount) }}</div>

        <el-alert
          v-if="payInfo.mock"
          type="warning"
          :closable="false"
          title="当前为 Mock 支付模式"
          description="后端未配置支付宝密钥，已生成本地沙箱收银台，点击下方按钮在新窗口完成模拟支付。"
          class="!items-start mb-4"
        />

        <div class="flex gap-3 justify-center">
          <el-button type="primary" @click="openCashier">打开收银台</el-button>
          <el-button :loading="syncing" @click="syncNow">我已支付，同步状态</el-button>
        </div>

        <div class="mt-4 text-xs text-ink-500">
          <span class="inline-flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            正在监听支付结果（WebSocket 实时推送）
          </span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { courseDetail, type CourseDetail } from '@/api/course';
import { createOrder, getPayForm, syncOrder } from '@/api/order';
import { SOCKET_EVENTS } from '@elp/shared';
import { useUserStore } from '@/stores/user';
import { useSocket } from '@/utils/socket';
import { fen2yuan, formatDate, formatDuration, LEVEL_LABEL } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const socket = useSocket();

const course = ref<CourseDetail | null>(null);
const loading = ref(true);
const paying = ref(false);
const syncing = ref(false);
const payVisible = ref(false);
const payInfo = ref<{ orderNo: string; payForm: string; amount: number; mock: boolean } | null>(null);
const activeChapters = ref<number[]>([]);
let offPayment: (() => void) | null = null;

const canPlay = (ls: any) => ls.isFree || course.value?.purchased;

async function load() {
  loading.value = true;
  try {
    course.value = await courseDetail(Number(route.params.id));
    activeChapters.value = course.value.chapters?.map((c) => c.id) ?? [];
  } finally {
    loading.value = false;
  }
}

function playLesson(ls: any) {
  if (!canPlay(ls)) {
    ElMessage.warning('购买后即可学习本课时');
    return;
  }
  router.push(`/study/${course.value!.id}?lessonId=${ls.id}`);
}

/** 下单 -> 取支付表单 -> 打开收银台 */
async function buy() {
  if (!userStore.isLogin) {
    router.push({ path: '/login', query: { redirect: route.fullPath } });
    return;
  }
  paying.value = true;
  try {
    const order = await createOrder({ courseId: course.value!.id, payType: 'ALIPAY' });
    if (order.status === 'PAID') {
      ElMessage.success('课程已开通');
      await load();
      return;
    }
    payInfo.value = await getPayForm(order.orderNo);
    payVisible.value = true;
  } catch {
    /* 已提示 */
  } finally {
    paying.value = false;
  }
}

function openCashier() {
  if (!payInfo.value) return;
  const win = window.open('', '_blank', 'width=420,height=640');
  if (!win) {
    ElMessage.warning('浏览器拦截了新窗口，请允许弹窗后重试');
    return;
  }
  win.document.write(payInfo.value.payForm);
  win.document.close();
}

async function syncNow() {
  if (!payInfo.value) return;
  syncing.value = true;
  try {
    const order = await syncOrder(payInfo.value.orderNo);
    if (order.status === 'PAID') {
      ElMessage.success('支付成功，课程已开通');
      payVisible.value = false;
      await load();
    } else {
      ElMessage.info('暂未查询到支付成功记录，请稍候再试');
    }
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  load();

  // 订阅支付结果（WebSocket 实时推送）
  offPayment = socket.on(SOCKET_EVENTS.PAYMENT_RESULT, async (payload: any) => {
    if (!payInfo.value || payload.orderNo !== payInfo.value.orderNo) return;
    if (payload.status === 'PAID') {
      ElMessage.success(payload.message || '支付成功，课程已开通');
      payVisible.value = false;
      await load();
    }
  });
});

onUnmounted(() => offPayment?.());
</script>
