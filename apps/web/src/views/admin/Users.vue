<template>
  <div class="elp-card p-5">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="elp-section-title mr-2">用户管理</h2>
      <el-input
        v-model="query.keyword"
        placeholder="搜索用户名 / 昵称 / 邮箱"
        clearable
        class="!w-64"
        @keyup.enter="reload"
        @clear="reload"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="query.role" placeholder="全部角色" clearable class="!w-32" @change="reload">
        <el-option label="用户" value="USER" />
        <el-option label="管理员" value="ADMIN" />
      </el-select>
      <el-select v-model="query.status" placeholder="全部状态" clearable class="!w-32" @change="reload">
        <el-option label="正常" value="ACTIVE" />
        <el-option label="禁用" value="DISABLED" />
      </el-select>
      <el-button class="ml-auto" @click="reload"><el-icon class="mr-1"><Refresh /></el-icon>刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column label="用户" min-width="200">
        <template #default="{ row }">
          <div class="flex items-center gap-3">
            <el-avatar :size="34" :src="row.avatar || ''">{{ row.nickname?.[0] }}</el-avatar>
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-900 line-clamp-1">{{ row.nickname }}</div>
              <div class="text-xs text-ink-500 line-clamp-1">@{{ row.username }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
      <el-table-column label="角色" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.role === 'ADMIN' ? 'danger' : 'info'">
            {{ row.role === 'ADMIN' ? '管理员' : '用户' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'ACTIVE' ? 'success' : 'danger'">
            {{ row.status === 'ACTIVE' ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="数据" width="180">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">
            订单 {{ row.orderCount }} · 课程 {{ row.courseCount }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="120">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatDate(row.createdAt, 'YYYY-MM-DD') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="showDetail(row)">详情</el-button>
          <el-button text type="warning" size="small" @click="resetPwd(row)">重置密码</el-button>
          <el-button
            text
            :type="row.status === 'ACTIVE' ? 'danger' : 'success'"
            size="small"
            :disabled="row.role === 'ADMIN'"
            @click="toggleStatus(row)"
          >
            {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
          </el-button>
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

    <!-- 详情 -->
    <el-drawer v-model="detailVisible" title="用户详情" size="480px">
      <div v-if="detail" class="space-y-4">
        <div class="flex items-center gap-4">
          <el-avatar :size="56" :src="detail.avatar || ''">{{ detail.nickname?.[0] }}</el-avatar>
          <div>
            <div class="text-lg font-semibold text-ink-900">{{ detail.nickname }}</div>
            <div class="text-sm text-ink-500">@{{ detail.username }} · {{ detail.email }}</div>
          </div>
        </div>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="角色">{{ detail.role }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
          <el-descriptions-item label="累计学习">
            {{ formatDuration(detail.totalDuration ?? 0) }}
          </el-descriptions-item>
          <el-descriptions-item label="日报数">{{ detail.reportCount }}</el-descriptions-item>
          <el-descriptions-item label="单词" :span="2">
            未学习 {{ detail.words?.NEW ?? 0 }} · 学习中 {{ detail.words?.LEARNING ?? 0 }} · 已掌握
            {{ detail.words?.MASTERED ?? 0 }}
          </el-descriptions-item>
        </el-descriptions>

        <div>
          <h4 class="font-medium text-ink-900 mb-2">最近订单</h4>
          <el-table :data="detail.recentOrders" size="small">
            <el-table-column prop="courseTitle" label="课程" show-overflow-tooltip />
            <el-table-column label="金额" width="90">
              <template #default="{ row }">¥{{ fen2yuan(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="ORDER_STATUS_LABEL[row.status]?.type as any">
                  {{ ORDER_STATUS_LABEL[row.status]?.text }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  adminResetPassword,
  adminUpdateUserStatus,
  adminUserDetail,
  adminUsers,
} from '@/api/admin';
import { fen2yuan, formatDate, formatDuration, ORDER_STATUS_LABEL } from '@/utils/format';

const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const detailVisible = ref(false);
const detail = ref<any>(null);

const query = reactive({ page: 1, pageSize: 10, keyword: '', role: '', status: '' });

async function load() {
  loading.value = true;
  try {
    const res = await adminUsers({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      role: query.role || undefined,
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

async function showDetail(row: any) {
  detail.value = await adminUserDetail(row.id);
  detailVisible.value = true;
}

async function toggleStatus(row: any) {
  const next = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  await ElMessageBox.confirm(
    `确定要${next === 'DISABLED' ? '禁用' : '启用'}用户「${row.nickname}」吗？`,
    '提示',
    { type: 'warning' },
  );
  await adminUpdateUserStatus(row.id, next);
  ElMessage.success('操作成功');
  load();
}

async function resetPwd(row: any) {
  const { value } = await ElMessageBox.prompt(
    `为用户「${row.nickname}」设置新密码（至少 6 位）`,
    '重置密码',
    { inputPattern: /^.{6,32}$/, inputErrorMessage: '密码长度 6-32 位' },
  );
  await adminResetPassword(row.id, value);
  ElMessage.success('密码已重置');
}

onMounted(load);
</script>
