<template>
  <div>
    <!-- 统计 -->
    <div class="grid sm:grid-cols-4 gap-4 mb-5">
      <div v-for="s in statCards" :key="s.label" class="elp-card p-5">
        <div class="text-xs text-ink-500 mb-1">{{ s.label }}</div>
        <div class="text-xl font-bold text-ink-900">{{ s.value }}</div>
      </div>
    </div>

    <div class="elp-card p-5">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="elp-section-title mr-2">文件存储</h2>
        <el-input
          v-model="query.keyword"
          placeholder="搜索文件名"
          clearable
          class="!w-56"
          @keyup.enter="reload"
          @clear="reload"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="ml-auto flex gap-3">
          <el-button @click="load"><el-icon class="mr-1"><Refresh /></el-icon>刷新</el-button>
          <el-button type="primary" :loading="uploading" @click="pickFile">
            <el-icon class="mr-1"><Upload /></el-icon>上传文件
          </el-button>
        </div>
      </div>

      <el-alert
        type="info"
        :closable="false"
        title="大文件分片上传 · 断点续传 · 秒传"
        description="上传前先按内容 hash 询问服务端：命中已存在文件则直接秒传；中断后再次上传会自动跳过已传分片，只补齐缺口。"
        class="mb-4 !items-start"
      />

      <input ref="fileInputRef" type="file" class="hidden" @change="onFileChange" />

      <el-progress
        v-if="uploading || uploadProgress > 0"
        :percentage="uploadProgress"
        :status="uploadProgress === 100 ? 'success' : undefined"
        class="mb-4"
      />

      <el-table v-loading="loading" :data="list">
        <el-table-column label="文件名" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-icon class="text-brand-500"><Document /></el-icon>
              <span class="text-sm text-ink-900">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ humanSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ row.mimeType }}</span>
          </template>
        </el-table-column>
        <el-table-column label="上传者" width="130">
          <template #default="{ row }">
            <span class="text-sm">@{{ row.user?.username ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'COMPLETED' ? 'success' : 'warning'">
              {{ row.status === 'COMPLETED' ? '已完成' : row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatDate(row.createdAt, 'MM-DD HH:mm') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="copyLink(row)">复制链接</el-button>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  adminDeleteFile,
  adminFileStats,
  adminFiles,
  completeUpload,
  initUpload,
  uploadChunk,
} from '@/api/file';
import { formatDate } from '@/utils/format';

const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const stats = ref<any>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const query = reactive({ page: 1, pageSize: 10, keyword: '' });

const CHUNK_SIZE = 5 * 1024 * 1024;

const statCards = computed(() => [
  { label: '存储驱动', value: stats.value?.driver ?? '-' },
  { label: '文件总数', value: stats.value?.fileCount ?? 0 },
  { label: '占用空间', value: humanSize(stats.value?.totalSize ?? 0) },
  { label: '今日上传', value: stats.value?.todayCount ?? 0 },
]);

function humanSize(bytes: number) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(2)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

async function load() {
  loading.value = true;
  try {
    const res = await adminFiles({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
    });
    list.value = res.list;
    total.value = res.total;
    stats.value = await adminFileStats().catch(() => null);
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

function pickFile() {
  fileInputRef.value?.click();
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 分块转 base64，避免大分片时 String.fromCharCode 爆栈 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  uploading.value = true;
  uploadProgress.value = 0;

  try {
    // 整文件 hash（用于秒传判定）
    const fullBuf = await file.arrayBuffer();
    const hash = await sha256Hex(fullBuf);
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

    const init = await initUpload({
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      hash,
      totalChunks,
    });

    if (init.instant) {
      uploadProgress.value = 100;
      ElMessage.success(`秒传成功：${file.name}`);
      return;
    }

    const done = new Set(init.uploadedChunks ?? []);
    if (done.size) {
      ElMessage.info(`检测到 ${done.size} 个已上传分片，继续断点续传`);
    }

    for (let i = 0; i < totalChunks; i++) {
      if (done.has(i)) {
        uploadProgress.value = Math.round(((i + 1) / totalChunks) * 100);
        continue;
      }
      const slice = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
      const buf = await slice.arrayBuffer();
      await uploadChunk(init.fileId, i, arrayBufferToBase64(buf));
      uploadProgress.value = Math.round(((i + 1) / totalChunks) * 100);
    }

    await completeUpload(init.fileId);
    ElMessage.success(`上传完成：${file.name}`);
    load();
  } catch (err: any) {
    ElMessage.error(err?.message ?? '上传失败');
  } finally {
    uploading.value = false;
    setTimeout(() => (uploadProgress.value = 0), 1500);
  }
}

function copyLink(row: any) {
  const url = row.url?.startsWith('http') ? row.url : `${location.origin}${row.url}`;
  navigator.clipboard.writeText(url).then(
    () => ElMessage.success('链接已复制'),
    () => ElMessage.warning('复制失败，请手动复制'),
  );
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除文件「${row.name}」吗？`, '警告', { type: 'warning' });
  await adminDeleteFile(row.id);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>
