<template>
  <div class="elp-card p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="elp-section-title">学习日报</h2>
      <span class="text-xs text-ink-500">每天 21:00 自动生成并发送至邮箱</span>
    </div>

    <el-empty v-if="!loading && !list.length" description="暂无日报，今天学习后系统会自动为你生成">
      <el-button type="primary" @click="$router.push('/courses')">去学习</el-button>
    </el-empty>

    <div v-loading="loading" class="space-y-4">
      <div v-for="r in list" :key="r.id" class="rounded-xl2 border border-[#e8ecf3] p-5">
        <div class="flex items-center gap-3 mb-3">
          <el-icon color="#2f74ff" :size="18"><Document /></el-icon>
          <span class="font-medium text-ink-900">{{ r.reportDate }}</span>
          <el-tag v-if="r.emailed" size="small" type="success">已发送邮件</el-tag>
          <el-tag v-else size="small" type="info">未发送</el-tag>
          <span class="ml-auto text-xs text-ink-500">
            学习 {{ Math.round((r.stats?.duration ?? 0) / 60) }} 分钟 · 复习单词 {{ r.stats?.wordsReviewed ?? 0 }} 个
          </span>
        </div>
        <div class="md-body text-sm text-ink-700" v-html="renderMarkdown(r.content)"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { myReports } from '@/api/study';
import { renderMarkdown } from '@/utils/format';

const list = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    list.value = await myReports(20);
  } finally {
    loading.value = false;
  }
});
</script>
