<template>
  <div class="elp-card p-5">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="elp-section-title mr-2">课程管理</h2>
      <el-input
        v-model="query.keyword"
        placeholder="搜索课程标题 / 讲师"
        clearable
        class="!w-60"
        @keyup.enter="reload"
        @clear="reload"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="query.status" placeholder="全部状态" clearable class="!w-32" @change="reload">
        <el-option label="草稿" value="DRAFT" />
        <el-option label="已上架" value="PUBLISHED" />
        <el-option label="已下架" value="OFFLINE" />
      </el-select>
      <el-button type="primary" class="ml-auto" @click="openEdit()">
        <el-icon class="mr-1"><Plus /></el-icon>新建课程
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column label="课程" min-width="240">
        <template #default="{ row }">
          <div class="flex items-center gap-3">
            <div class="w-16 h-11 rounded-md overflow-hidden bg-ink-100 shrink-0">
              <img v-if="row.cover" :src="row.cover" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full grid place-items-center bg-brand-500 text-white text-xs">
                {{ row.title[0] }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-900 line-clamp-1">{{ row.title }}</div>
              <div class="text-xs text-ink-500 line-clamp-1">{{ row.subtitle }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="分类" width="100">
        <template #default="{ row }">{{ row.categoryName || '-' }}</template>
      </el-table-column>
      <el-table-column label="难度" width="90">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ LEVEL_LABEL[row.level] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="价格" width="110">
        <template #default="{ row }">
          <span class="text-[#f56c6c] font-medium">¥{{ fen2yuan(row.price) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="课时" width="80">
        <template #default="{ row }">{{ row.lessonCount }}</template>
      </el-table-column>
      <el-table-column label="销量" width="80">
        <template #default="{ row }">{{ row.sales }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openContent(row)">目录</el-button>
          <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button
            text
            :type="row.status === 'PUBLISHED' ? 'warning' : 'success'"
            size="small"
            @click="toggleStatus(row)"
          >
            {{ row.status === 'PUBLISHED' ? '下架' : '上架' }}
          </el-button>
          <el-button text type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="flex justify-end mt-4">
      <el-pagination
        layout="prev, pager, next, total"
        :total="total"
        :page-size="query.pageSize"
        :current-page="query.page"
        background
        @current-change="onPage"
      />
    </div>

    <!-- 课程编辑 -->
    <el-dialog v-model="editVisible" :title="form.id ? '编辑课程' : '新建课程'" width="680px">
      <el-form :model="form" label-width="86px">
        <el-row :gutter="12">
          <el-col :span="16">
            <el-form-item label="课程标题" required>
              <el-input v-model="form.title" placeholder="如：零基础英语口语突破" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="讲师">
              <el-input v-model="form.teacher" placeholder="讲师名" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" placeholder="一句话卖点" />
        </el-form-item>

        <el-form-item label="封面地址">
          <el-input v-model="form.cover" placeholder="https://..." />
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="售价(元)">
              <el-input-number v-model="priceYuan" :min="0" :precision="2" class="!w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="原价(元)">
              <el-input-number v-model="originalYuan" :min="0" :precision="2" class="!w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="难度">
              <el-select v-model="form.level" class="w-full">
                <el-option label="入门" value="BEGINNER" />
                <el-option label="进阶" value="INTERMEDIATE" />
                <el-option label="高级" value="ADVANCED" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="分类">
              <el-select v-model="form.categoryId" clearable class="w-full">
                <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-select v-model="form.status" class="w-full">
                <el-option label="草稿" value="DRAFT" />
                <el-option label="上架" value="PUBLISHED" />
                <el-option label="下架" value="OFFLINE" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序">
              <el-input-number v-model="form.sort" :min="0" class="!w-full" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="标签">
          <el-tag
            v-for="t in form.tags"
            :key="t"
            closable
            class="mr-1"
            @close="form.tags = form.tags.filter((x: string) => x !== t)"
          >
            {{ t }}
          </el-tag>
          <el-input
            v-model="tagInput"
            size="small"
            class="!w-24 ml-1"
            placeholder="+标签"
            @keyup.enter="addTag"
          />
        </el-form-item>

        <el-form-item label="课程介绍">
          <el-input v-model="form.description" type="textarea" :rows="5" placeholder="课程详细介绍" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 目录管理 -->
    <el-dialog v-model="contentVisible" :title="`目录管理 · ${currentCourse?.title ?? ''}`" width="820px">
      <div class="mb-3">
        <el-button type="primary" size="small" @click="addChapter">
          <el-icon class="mr-1"><Plus /></el-icon>新增章节
        </el-button>
      </div>

      <div v-for="(ch, ci) in chapters" :key="ch.id" class="border border-[#e8ecf3] rounded-xl2 p-3 mb-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm font-medium text-ink-900">第 {{ ci + 1 }} 章 · {{ ch.title }}</span>
          <el-button text type="primary" size="small" @click="addLesson(ch)">+ 课时</el-button>
          <el-button text type="danger" size="small" class="ml-auto" @click="removeChapter(ch)">删除章节</el-button>
        </div>

        <el-table :data="ch.lessons ?? []" size="small">
          <el-table-column prop="title" label="课时标题" min-width="180" />
          <el-table-column label="时长" width="90">
            <template #default="{ row }">{{ Math.round(row.duration / 60) }} 分钟</template>
          </el-table-column>
          <el-table-column label="试看" width="70">
            <template #default="{ row }">
              <el-tag size="small" :type="row.isFree ? 'success' : 'info'">{{ row.isFree ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="视频" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="text-xs text-ink-500">{{ row.videoUrl || '未配置' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="editLesson(ch, row)">编辑</el-button>
              <el-button text type="danger" size="small" @click="removeLesson(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="!chapters.length" description="还没有章节，先新增一个吧" />
    </el-dialog>

    <!-- 课时编辑 -->
    <el-dialog v-model="lessonVisible" :title="lessonForm.id ? '编辑课时' : '新增课时'" width="520px">
      <el-form :model="lessonForm" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="lessonForm.title" />
        </el-form-item>
        <el-form-item label="视频地址">
          <el-input v-model="lessonForm.videoUrl" placeholder="mp4 直链或 m3u8" />
        </el-form-item>
        <el-form-item label="时长(秒)">
          <el-input-number v-model="lessonForm.duration" :min="0" class="!w-full" />
        </el-form-item>
        <el-form-item label="允许试看">
          <el-switch v-model="lessonForm.isFree" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="lessonForm.sort" :min="0" class="!w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="lessonVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLesson">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  adminAddChapter,
  adminAddLesson,
  adminChangeCourseStatus,
  adminCourses,
  adminCreateCourse,
  adminDeleteChapter,
  adminDeleteCourse,
  adminDeleteLesson,
  adminUpdateCourse,
  adminUpdateLesson,
  courseCategories,
  courseDetail,
} from '@/api/course';
import { fen2yuan, LEVEL_LABEL } from '@/utils/format';

const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const categories = ref<any[]>([]);

const query = reactive({ page: 1, pageSize: 10, keyword: '', status: '' });

const editVisible = ref(false);
const contentVisible = ref(false);
const lessonVisible = ref(false);
const currentCourse = ref<any>(null);
const chapters = ref<any[]>([]);
const tagInput = ref('');
const priceYuan = ref(0);
const originalYuan = ref(0);
const currentChapter = ref<any>(null);

const form = reactive<any>({
  id: 0,
  title: '',
  subtitle: '',
  cover: '',
  description: '',
  price: 0,
  originalPrice: 0,
  level: 'BEGINNER',
  categoryId: undefined,
  teacher: '',
  tags: [] as string[],
  status: 'DRAFT',
  sort: 0,
});

const lessonForm = reactive<any>({ id: 0, title: '', videoUrl: '', duration: 600, isFree: false, sort: 0 });

const statusText = (s: string) => ({ DRAFT: '草稿', PUBLISHED: '已上架', OFFLINE: '已下架' })[s] ?? s;
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const statusType = (s: string): TagType =>
  (({ DRAFT: 'info', PUBLISHED: 'success', OFFLINE: 'warning' }) as Record<string, TagType>)[s] ?? 'info';

async function load() {
  loading.value = true;
  try {
    const res = await adminCourses({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
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

function openEdit(row?: any) {
  if (row) {
    Object.assign(form, {
      ...row,
      tags: row.tags ?? [],
      categoryId: row.categoryId ?? undefined,
    });
    priceYuan.value = row.price / 100;
    originalYuan.value = (row.originalPrice ?? 0) / 100;
  } else {
    Object.assign(form, {
      id: 0,
      title: '',
      subtitle: '',
      cover: '',
      description: '',
      price: 0,
      originalPrice: 0,
      level: 'BEGINNER',
      categoryId: undefined,
      teacher: '',
      tags: [],
      status: 'DRAFT',
      sort: 0,
    });
    priceYuan.value = 0;
    originalYuan.value = 0;
  }
  editVisible.value = true;
}

function addTag() {
  const v = tagInput.value.trim();
  if (v && !form.tags.includes(v)) form.tags.push(v);
  tagInput.value = '';
}

async function save() {
  if (!form.title?.trim()) {
    ElMessage.warning('请填写课程标题');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...form,
      price: Math.round(priceYuan.value * 100),
      originalPrice: Math.round(originalYuan.value * 100),
    };
    if (form.id) await adminUpdateCourse(form.id, payload);
    else await adminCreateCourse(payload);
    ElMessage.success('已保存');
    editVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: any) {
  const next = row.status === 'PUBLISHED' ? 'OFFLINE' : 'PUBLISHED';
  await adminChangeCourseStatus(row.id, next);
  ElMessage.success(next === 'PUBLISHED' ? '已上架' : '已下架');
  load();
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除课程「${row.title}」吗？`, '警告', { type: 'warning' });
  const res: any = await adminDeleteCourse(row.id);
  ElMessage.success(res?.message ?? '已删除');
  load();
}

/* ------------------------- 目录管理 ------------------------- */

async function openContent(row: any) {
  currentCourse.value = row;
  const detail = await courseDetail(row.id);
  chapters.value = detail.chapters ?? [];
  contentVisible.value = true;
}

async function addChapter() {
  const { value } = await ElMessageBox.prompt('章节标题', '新增章节', {
    inputPlaceholder: '如：第一章 发音基础',
  });
  await adminAddChapter(currentCourse.value.id, { title: value, sort: chapters.value.length });
  ElMessage.success('已新增');
  openContent(currentCourse.value);
}

async function removeChapter(ch: any) {
  await ElMessageBox.confirm(`删除章节「${ch.title}」将同时删除其课时，确定吗？`, '警告', {
    type: 'warning',
  });
  await adminDeleteChapter(ch.id);
  ElMessage.success('已删除');
  openContent(currentCourse.value);
}

function addLesson(ch: any) {
  currentChapter.value = ch;
  Object.assign(lessonForm, { id: 0, title: '', videoUrl: '', duration: 600, isFree: false, sort: (ch.lessons?.length ?? 0) });
  lessonVisible.value = true;
}

function editLesson(ch: any, row: any) {
  currentChapter.value = ch;
  Object.assign(lessonForm, row);
  lessonVisible.value = true;
}

async function saveLesson() {
  if (!lessonForm.title?.trim()) {
    ElMessage.warning('请填写课时标题');
    return;
  }
  if (lessonForm.id) {
    await adminUpdateLesson(lessonForm.id, { ...lessonForm });
  } else {
    await adminAddLesson(currentCourse.value.id, currentChapter.value.id, { ...lessonForm });
  }
  ElMessage.success('已保存');
  lessonVisible.value = false;
  openContent(currentCourse.value);
}

async function removeLesson(row: any) {
  await ElMessageBox.confirm(`确定删除课时「${row.title}」吗？`, '警告', { type: 'warning' });
  await adminDeleteLesson(row.id);
  ElMessage.success('已删除');
  openContent(currentCourse.value);
}

onMounted(async () => {
  categories.value = await courseCategories().catch(() => []);
  load();
});
</script>
