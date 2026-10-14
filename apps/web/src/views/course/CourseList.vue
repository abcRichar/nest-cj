<template>
  <div class="max-w-[1200px] mx-auto px-5 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-ink-900 mb-2">课程中心</h1>
      <p class="text-sm text-ink-500">共 {{ total }} 门课程，按你的节奏选一门开始</p>
    </div>

    <!-- 筛选 -->
    <div class="elp-card p-4 mb-6 flex flex-wrap items-center gap-3">
      <el-input
        v-model="query.keyword"
        placeholder="搜索课程 / 讲师"
        clearable
        class="!w-60"
        @keyup.enter="reload"
        @clear="reload"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>

      <el-select v-model="query.categoryId" placeholder="全部分类" clearable class="!w-40" @change="reload">
        <el-option v-for="c in categories" :key="c.id" :label="`${c.name} (${c.courseCount})`" :value="c.id" />
      </el-select>

      <el-select v-model="query.level" placeholder="全部难度" clearable class="!w-36" @change="reload">
        <el-option label="入门" value="BEGINNER" />
        <el-option label="进阶" value="INTERMEDIATE" />
        <el-option label="高级" value="ADVANCED" />
      </el-select>

      <el-radio-group v-model="query.sortBy" @change="reload">
        <el-radio-button label="latest">最新</el-radio-button>
        <el-radio-button label="hot">最热</el-radio-button>
        <el-radio-button label="price_asc">价格↑</el-radio-button>
        <el-radio-button label="price_desc">价格↓</el-radio-button>
      </el-radio-group>

      <el-button class="ml-auto" @click="reset">重置</el-button>
    </div>

    <div v-loading="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <CourseCard v-for="c in list" :key="c.id" :course="c" @click="$router.push(`/courses/${c.id}`)" />
    </div>

    <el-empty v-if="!loading && !list.length" description="没有找到符合条件的课程" />

    <div v-if="total > query.pageSize" class="flex justify-center mt-8">
      <el-pagination
        layout="prev, pager, next, total"
        :total="total"
        :page-size="query.pageSize"
        :current-page="query.page"
        background
        @current-change="onPage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import CourseCard from '@/components/CourseCard.vue';
import { courseCategories, listCourses } from '@/api/course';
import type { Course, CourseCategory } from '@elp/shared';

const list = ref<Course[]>([]);
const categories = ref<CourseCategory[]>([]);
const total = ref(0);
const loading = ref(false);

const query = reactive({
  page: 1,
  pageSize: 9,
  keyword: '',
  categoryId: undefined as number | undefined,
  level: '',
  sortBy: 'latest',
});

async function load() {
  loading.value = true;
  try {
    const res = await listCourses({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      categoryId: query.categoryId,
      level: query.level || undefined,
      sortBy: query.sortBy,
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function reload() {
  query.page = 1;
  load();
}

function onPage(p: number) {
  query.page = p;
  load();
}

function reset() {
  query.keyword = '';
  query.categoryId = undefined;
  query.level = '';
  query.sortBy = 'latest';
  reload();
}

onMounted(async () => {
  load();
  courseCategories().then((c) => (categories.value = c)).catch(() => void 0);
});
</script>
