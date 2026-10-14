<template>
  <div class="elp-card p-5">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="elp-section-title mr-2">学习日报</h2>
      <span class="text-xs text-ink-500">
        每天 21:00 由定时任务聚合学习数据 → AI 生成日报 → 邮件推送
      </span>
      <div class="ml-auto flex gap-3">
        <el-date-picker
          v-model="date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          class="!w-40"
        />
        <el-button type="primary" :loading="triggering" @click="trigger">
          <el-icon class="mr-1"><Promotion /></el-icon>立即生成
        </el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column label="用户" width="140">
        <template #default="{ row }">
          <div class="text-sm text-ink-900">{{ row.user?.nickname }}</div>
          <div class="text-xs text-ink-500">@{{ row.user?.username }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="reportDate" label="日期" width="120" />
      <el-table-column label="学习时长" width="110">
        <template #default="{ row }">
          {{ Math.round((parseStats(row.stats)?.duration ?? 0) / 60) }} 分钟
        </template>
      </el-table-column>
      <el-table-column label="复习单词" width="100">
        <template #default="{ row }">{{ parseStats(row.stats)?.wordsReviewed ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="内容摘要" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="text-sm text-ink-500">{{ row.content?.slice(0, 80) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="邮件" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.emailed ? 'success' : 'info'">
            {{ row.emailed ? '已发送' : '未发送' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="view(row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="flex justify-end mt-4">
      <el-pagination
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        background
        @current-change="load"
      />
    </div>

    <el-dialog v-model="viewVisible" title="日报详情" width="640px">
      <div v-if="current">
        <div class="flex items-center gap-3 mb-3">
          <span class="font-medium text-ink-900">{{ current.user?.nickname }}</span>
          <el-tag size="small">{{ current.reportDate }}</el-tag>
        </div>
        <div class="md-body text-sm text-ink-700" v-html="renderMarkdown(current.content)"></div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminReports, adminTriggerReports } from '@/api/admin';
import { renderMarkdown } from '@/utils/format';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const triggering = ref(false);
const date = ref('');
const viewVisible = ref(false);
const current = ref<any>(null);

function parseStats(raw: any) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const res = await adminReports({ page: p, pageSize: pageSize.value });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function trigger() {
  await ElMessageBox.confirm(
    `将为${date.value ? ` ${date.value} ` : '今日'}有学习行为的用户生成日报并发送邮件，确定继续吗？`,
    '确认生成',
    { type: 'warning' },
  );
  triggering.value = true;
  try {
    const res: any = await adminTriggerReports(date.value || undefined);
    ElMessage.success(`共 ${res.total} 人，成功生成 ${res.generated} 份`);
    load(1);
  } finally {
    triggering.value = false;
  }
}

function view(row: any) {
  current.value = row;
  viewVisible.value = true;
}

onMounted(() => load(1));
</script>
