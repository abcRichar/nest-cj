<template>
  <div v-loading="loading" class="max-w-[1200px] mx-auto px-5 py-6">
    <template v-if="course">
      <div class="flex items-center gap-3 mb-4">
        <el-button text @click="$router.back()"><el-icon><ArrowLeft /></el-icon>返回</el-button>
        <h1 class="text-lg font-semibold text-ink-900">{{ course.title }}</h1>
        <el-progress
          :percentage="progress"
          :stroke-width="8"
          class="!w-48 ml-auto"
          :format="(p: number) => `进度 ${p}%`"
        />
      </div>

      <div class="grid lg:grid-cols-[1fr_320px] gap-6">
        <!-- 播放区 -->
        <div>
          <div class="elp-card overflow-hidden">
            <div class="aspect-video bg-[#0b1220] relative">
              <video
                v-if="currentLesson?.videoUrl"
                ref="videoRef"
                :src="currentLesson.videoUrl"
                class="w-full h-full"
                controls
                playsinline
                @timeupdate="onTimeUpdate"
                @ended="onEnded"
              ></video>
              <div v-else class="w-full h-full grid place-items-center text-white/60 text-center px-6">
                <div>
                  <el-icon :size="46" class="mb-3"><VideoCamera /></el-icon>
                  <p class="text-sm">该课时暂未上传视频</p>
                  <p class="text-xs text-white/40 mt-1">可在管理端「课程管理 → 课时」中配置视频地址</p>
                </div>
              </div>
            </div>

            <div class="p-5">
              <h2 class="text-base font-semibold text-ink-900 mb-2">
                {{ currentLesson?.title || '请选择课时' }}
              </h2>
              <p class="text-sm text-ink-500">
                {{ currentLesson ? `时长 ${formatDuration(currentLesson.duration)}` : '' }}
              </p>
            </div>
          </div>

          <div class="elp-card p-5 mt-5">
            <h3 class="elp-section-title mb-3">学习说明</h3>
            <ul class="text-sm text-ink-500 leading-relaxed list-disc pl-5 space-y-1">
              <li>学习时长会自动上报，用于生成每日学习日报。</li>
              <li>课时完成后学习进度自动更新，可在「我的课程」查看。</li>
              <li>长时间停留同一页不计入有效时长（每分钟最多计 60 秒）。</li>
            </ul>
          </div>
        </div>

        <!-- 目录 -->
        <div class="elp-card p-4 h-fit max-h-[calc(100vh-160px)] overflow-auto">
          <h3 class="font-semibold text-ink-900 mb-3 px-1">课程目录</h3>
          <div v-for="(ch, ci) in course.chapters" :key="ch.id" class="mb-3">
            <div class="text-xs text-ink-500 px-1 mb-1">第 {{ ci + 1 }} 章 · {{ ch.title }}</div>
            <div
              v-for="ls in ch.lessons"
              :key="ls.id"
              class="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm"
              :class="
                ls.id === currentLesson?.id
                  ? 'bg-brand-50 text-brand-600 font-medium'
                  : 'text-ink-700 hover:bg-[#f7f9fc]'
              "
              @click="switchLesson(ls)"
            >
              <el-icon :size="14">
                <VideoPlay v-if="ls.id === currentLesson?.id" />
                <Check v-else-if="isDone(ls.id)" class="text-[#22a06b]" />
                <VideoPause v-else />
              </el-icon>
              <span class="flex-1 line-clamp-1">{{ ls.title }}</span>
              <span class="text-xs text-ink-500">{{ Math.round(ls.duration / 60) }}m</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { courseDetail, type CourseDetail } from '@/api/course';
import { courseProgress, reportProgress } from '@/api/study';
import { formatDuration } from '@/utils/format';

const route = useRoute();

const course = ref<CourseDetail | null>(null);
const lessonProgress = ref<Record<number, number>>({});
const loading = ref(true);
const videoRef = ref<HTMLVideoElement | null>(null);
const currentLesson = ref<any>(null);

let lastTick = Date.now();
let pendingSeconds = 0;
let flushTimer: number | undefined;

const progress = computed(() => {
  if (!course.value?.chapters?.length) return course.value?.progress ?? 0;
  const all = course.value.chapters.flatMap((c) => c.lessons ?? []);
  if (!all.length) return course.value?.progress ?? 0;
  const done = all.filter((l) => (lessonProgress.value[l.id] ?? 0) >= 90).length;
  return Math.round((done / all.length) * 100);
});

const isDone = (lessonId: number) => (lessonProgress.value[lessonId] ?? 0) >= 90;

async function load() {
  loading.value = true;
  try {
    const id = Number(route.params.courseId);
    course.value = await courseDetail(id);

    const cp = await courseProgress(id).catch(() => null);
    if (cp) {
      lessonProgress.value = Object.fromEntries(cp.lessons.map((l) => [l.lessonId, l.progress]));
    }

    const all = course.value.chapters.flatMap((c) => c.lessons ?? []);
    const targetId = Number(route.query.lessonId) || course.value.lastLessonId || all[0]?.id;
    currentLesson.value = all.find((l) => l.id === targetId) ?? all[0] ?? null;

    if (!course.value.purchased && !currentLesson.value?.isFree) {
      ElMessage.warning('请先购买课程后开始学习');
    }
  } finally {
    loading.value = false;
  }
}

function switchLesson(ls: any) {
  if (!course.value?.purchased && !ls.isFree) {
    ElMessage.warning('购买后即可学习本课时');
    return;
  }
  flush();
  currentLesson.value = ls;
  lastTick = Date.now();
  pendingSeconds = 0;
}

/** 每 15 秒上报一次学习时长（避免频繁请求） */
function onTimeUpdate() {
  const now = Date.now();
  const delta = (now - lastTick) / 1000;
  lastTick = now;
  // 单次间隔超过 5 秒视为切后台，不计入
  if (delta > 0 && delta < 5) pendingSeconds += delta;
}

async function flush() {
  if (!course.value || !currentLesson.value || pendingSeconds < 3) {
    pendingSeconds = 0;
    return;
  }
  const duration = Math.round(pendingSeconds);
  pendingSeconds = 0;

  const video = videoRef.value;
  let pct = lessonProgress.value[currentLesson.value.id] ?? 0;
  if (video && video.duration) {
    pct = Math.max(pct, Math.round((video.currentTime / video.duration) * 100));
  } else {
    // 无视频时，按停留时长折算（以课时时长为准）
    const target = currentLesson.value.duration || 600;
    pct = Math.max(pct, Math.min(100, Math.round((duration / target) * 100)));
  }

  try {
    await reportProgress({
      courseId: course.value.id,
      lessonId: currentLesson.value.id,
      duration,
      progress: pct,
    });
    lessonProgress.value[currentLesson.value.id] = pct;
  } catch {
    /* 忽略上报失败 */
  }
}

function onEnded() {
  if (currentLesson.value) {
    lessonProgress.value[currentLesson.value.id] = 100;
  }
  flush();
  const all = course.value?.chapters.flatMap((c) => c.lessons ?? []) ?? [];
  const idx = all.findIndex((l) => l.id === currentLesson.value?.id);
  if (idx >= 0 && idx < all.length - 1) {
    setTimeout(() => switchLesson(all[idx + 1]), 1200);
  }
}

onMounted(() => {
  load();
  flushTimer = window.setInterval(flush, 15000);
});

onUnmounted(() => {
  if (flushTimer) window.clearInterval(flushTimer);
  flush();
});
</script>
