<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-[#0f1b2d] text-white">
      <ThreeHero />
      <div class="relative max-w-[1200px] mx-auto px-5 py-20 lg:py-28 pointer-events-none">
        <div class="max-w-[620px]">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs text-brand-200 mb-5 border border-white/10"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-brand-300 animate-pulse"></span>
            Vue3 · NestJS · LangGraph 全栈 Monorepo 实践
          </div>
          <h1 class="text-4xl lg:text-5xl font-bold leading-tight mb-5">
            用 AI 陪你练英语<br />
            <span
              class="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent"
            >
              每一句都有人回应
            </span>
          </h1>
          <p class="text-white/65 text-base lg:text-lg leading-relaxed mb-8">
            课程学习、单词记忆、AI 智能对话三位一体。多角色 AI 助教支持上下文记忆与联网搜索，
            流式输出让你像和真人对话一样顺畅。
          </p>
          <div class="flex flex-wrap gap-3 pointer-events-auto">
            <el-button type="primary" size="large" round @click="go('/courses')">
              开始学习
            </el-button>
            <el-button
              size="large"
              round
              class="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
              @click="go('/chat')"
            >
              体验 AI 对话
            </el-button>
          </div>

          <div class="mt-10 flex flex-wrap gap-8 text-white/70 text-sm">
            <div>
              <div class="text-2xl font-bold text-white">{{ stats.courseCount }}</div>
              <div>门精品课程</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-white">{{ stats.userCount }}</div>
              <div>名学习者</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-white">{{ stats.roleCount }}</div>
              <div>个 AI 角色</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 数据概览（已登录） -->
    <section v-if="userStore.isLogin && overview" class="max-w-[1200px] mx-auto px-5 -mt-8 relative z-10">
      <div class="elp-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="item in overviewCards"
          :key="item.label"
          class="rounded-xl2 bg-[#f7f9fc] p-4 flex items-center gap-3"
        >
          <div
            class="w-10 h-10 rounded-xl grid place-items-center"
            :style="{ background: item.bg, color: item.color }"
          >
            <el-icon :size="19"><component :is="item.icon" /></el-icon>
          </div>
          <div>
            <div class="text-xl font-bold text-ink-900">{{ item.value }}</div>
            <div class="text-xs text-ink-500">{{ item.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 推荐课程 -->
    <section class="max-w-[1200px] mx-auto px-5 py-14">
      <div class="flex items-end justify-between mb-6">
        <div>
          <h2 class="elp-section-title text-xl">热门课程</h2>
          <p class="elp-sub mt-1 ml-3">从入门到进阶，系统化提升英语能力</p>
        </div>
        <el-button text type="primary" @click="go('/courses')">
          查看全部 <el-icon class="ml-1"><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div v-loading="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <CourseCard v-for="c in courses" :key="c.id" :course="c" @click="go(`/courses/${c.id}`)" />
        <el-empty v-if="!loading && !courses.length" description="暂无课程" class="col-span-full" />
      </div>
    </section>

    <!-- 能力介绍 -->
    <section class="bg-white border-y border-[#e8ecf3] py-14">
      <div class="max-w-[1200px] mx-auto px-5">
        <h2 class="elp-section-title text-xl mb-8">平台能力</h2>
        <div class="grid md:grid-cols-3 gap-5">
          <div
            v-for="f in features"
            :key="f.title"
            class="rounded-xl2 border border-[#e8ecf3] p-6 hover:shadow-hover transition-shadow"
          >
            <div
              class="w-11 h-11 rounded-xl grid place-items-center mb-4"
              :style="{ background: f.bg, color: f.color }"
            >
              <el-icon :size="21"><component :is="f.icon" /></el-icon>
            </div>
            <h3 class="font-semibold text-ink-900 mb-2">{{ f.title }}</h3>
            <p class="text-sm text-ink-500 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- AI 角色 -->
    <section class="max-w-[1200px] mx-auto px-5 py-14">
      <h2 class="elp-section-title text-xl mb-6">选择一个 AI 学习伙伴</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div
          v-for="r in roles"
          :key="r.id"
          class="elp-card elp-card-hover p-5 cursor-pointer text-center"
          @click="startChat(r)"
        >
          <el-avatar :size="56" :src="r.avatar || ''" class="mb-3">{{ r.name[0] }}</el-avatar>
          <div class="font-medium text-ink-900">{{ r.name }}</div>
          <div class="text-xs text-ink-500 mt-1 line-clamp-2 h-8">{{ r.description }}</div>
          <el-tag v-if="r.enableSearch" size="small" type="success" class="mt-2">支持联网搜索</el-tag>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import CourseCard from '@/components/CourseCard.vue';
import ThreeHero from '@/components/ThreeHero.vue';
import { listCourses } from '@/api/course';
import { listRoles } from '@/api/chat';
import { studyOverview } from '@/api/study';
import { wordStats } from '@/api/word';
import { useUserStore } from '@/stores/user';
import { formatDuration } from '@/utils/format';
import type { AiRole, Course, StudyOverview } from '@elp/shared';

const router = useRouter();
const userStore = useUserStore();

const courses = ref<Course[]>([]);
const roles = ref<AiRole[]>([]);
const overview = ref<StudyOverview | null>(null);
const wordStat = ref<any>(null);
const loading = ref(true);

const stats = ref({ courseCount: 0, userCount: '10k+', roleCount: 0 });

const overviewCards = computed(() => [
  {
    label: '累计学习',
    value: overview.value ? formatDuration(overview.value.totalDuration) : '-',
    icon: 'Clock',
    bg: '#eef5ff',
    color: '#2f74ff',
  },
  {
    label: '已购课程',
    value: overview.value?.courseCount ?? 0,
    icon: 'Reading',
    bg: '#f2fff6',
    color: '#22a06b',
  },
  {
    label: '已掌握单词',
    value: wordStat.value?.mastered ?? 0,
    icon: 'Collection',
    bg: '#fff7f2',
    color: '#e07b39',
  },
  {
    label: '待复习单词',
    value: wordStat.value?.due ?? 0,
    icon: 'AlarmClock',
    bg: '#f6f2ff',
    color: '#7c5cff',
  },
]);

const features = [
  {
    title: 'ReAct 智能助教',
    desc: '基于 LangGraph 构建的 ReAct Agent，能思考、会查资料、按步骤解答，而不是一次性吐答案。',
    icon: 'MagicStick',
    bg: '#eef5ff',
    color: '#2f74ff',
  },
  {
    title: '流式对话体验',
    desc: '服务端 SSE 持续推送生成内容，前端边收边渲染，长文本回答无需等待。',
    icon: 'Lightning',
    bg: '#fff7e6',
    color: '#e6a23c',
  },
  {
    title: '单词科学记忆',
    desc: '按艾宾浩斯遗忘曲线自动排期复习，答错重置周期，连续答对自动判定为已掌握。',
    icon: 'Collection',
    bg: '#f2fff6',
    color: '#22a06b',
  },
  {
    title: '学习数据日报',
    desc: '定时任务聚合当日学习数据，由 AI 生成个性化日报并自动发送到你的邮箱。',
    icon: 'Document',
    bg: '#f6f2ff',
    color: '#7c5cff',
  },
  {
    title: '支付结果实时同步',
    desc: '支付宝异步回调确认订单后，通过 WebSocket 把支付结果实时推送到你的浏览器。',
    icon: 'Tickets',
    bg: '#eef5ff',
    color: '#1656f0',
  },
  {
    title: '对象存储',
    desc: '基于 MinIO 的文件存储，支持大文件分片上传、断点续传与秒传。',
    icon: 'FolderOpened',
    bg: '#f2fff6',
    color: '#22a06b',
  },
];

function go(path: string) {
  router.push(path);
}

function startChat(role: AiRole) {
  router.push({ path: '/chat', query: { roleId: role.id } });
}

onMounted(async () => {
  try {
    const [courseRes, roleRes] = await Promise.all([
      listCourses({ page: 1, pageSize: 6, sortBy: 'hot' }),
      listRoles().catch(() => [] as AiRole[]),
    ]);
    courses.value = courseRes.list;
    roles.value = roleRes;
    stats.value.courseCount = courseRes.total;
    stats.value.roleCount = roleRes.length;
  } finally {
    loading.value = false;
  }

  if (userStore.isLogin) {
    studyOverview().then((o) => (overview.value = o)).catch(() => void 0);
    wordStats().then((s) => (wordStat.value = s)).catch(() => void 0);
  }
});
</script>
