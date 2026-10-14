<template>
  <div class="elp-card p-5">
    <h2 class="elp-section-title mb-4">我的课程</h2>

    <div v-loading="loading" class="grid sm:grid-cols-2 gap-4">
      <div v-for="mc in list" :key="mc.courseId" class="rounded-xl2 border border-[#e8ecf3] p-4 flex gap-4">
        <div class="w-24 h-16 rounded-lg overflow-hidden bg-ink-100 shrink-0">
          <img v-if="mc.course.cover" :src="mc.course.cover" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full grid place-items-center bg-brand-500 text-white font-bold">
            {{ mc.course.title[0] }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink-900 line-clamp-1 mb-1">{{ mc.course.title }}</div>
          <el-progress :percentage="mc.progress" :stroke-width="6" :show-text="false" />
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-ink-500">进度 {{ mc.progress }}%</span>
            <el-button type="primary" text size="small" @click="$router.push(`/study/${mc.courseId}`)">
              继续学习
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-if="!loading && !list.length" description="还没有购买课程">
      <el-button type="primary" @click="$router.push('/courses')">去逛逛</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { myCourses } from '@/api/course';
import type { MyCourse } from '@elp/shared';

const list = ref<MyCourse[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    list.value = await myCourses();
  } finally {
    loading.value = false;
  }
});
</script>
