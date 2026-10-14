<template>
  <div class="elp-card p-5">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="elp-section-title mr-2">订单管理</h2>
      <el-input
        v-model="query.keyword"
        placeholder="订单号 / 用户名 / 课程名"
        clearable
        class="!w-64"
        @keyup.enter="reload"
        @clear="reload"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="query.status" placeholder="全部状态" clearable class="!w-32" @change="reload">
        <el-option label="待支付" value="PENDING" />
        <el-option label="已支付" value="PAID" />
        <el-option label="已取消" value="CANCELLED" />
        <el-option label="已退款" value="REFUNDED" />
      </el-select>
      <el-date-picker
        v-model="range"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        class="!w-64"
        @change="reload"
      />
      <el-button class="ml-auto" @click="reload"><el-icon class="mr-1"><Refresh /></el-icon>刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column prop="orderNo" label="订单号" min-width="190">
        <template #default="{ row }">
          <span class="text-xs text-ink-700 break-all">{{ row.orderNo }}</span>
        </template>
      </el-table-column>
      <el-table-column label="用户" width="140">
        <template #default="{ row }">
          <div class="text-sm text-ink-900">{{ row.user?.nickname }}</div>
          <div class="text-xs text-ink-500">@{{ row.user?.username }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="courseTitle" label="课程" min-width="180" show-overflow-tooltip />
      <el-table-column label="金额" width="100">
        <template #default="{ row }">
          <span class="font-medium text-[#f56c6c]">¥{{ fen2yuan(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="支付方式" width="90">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ row.payType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="ORDER_STATUS_LABEL[row.status]?.type as any">
            {{ ORDER_STATUS_LABEL[row.status]?.text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="支付时间" width="150">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">
            {{ row.paidAt ? formatDate(row.paidAt, 'MM-DD HH:mm') : '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="下单时间" width="150">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatDate(row.createdAt, 'MM-DD HH:mm') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'PAID'"
            text
            type="danger"
            size="small"
            @click="refund(row)"
          >
            退款
          </el-button>
          <span v-else class="text-xs text-ink-500">-</span>
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
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminOrders, adminRefund } from '@/api/order';
import { fen2yuan, formatDate, ORDER_STATUS_LABEL } from '@/utils/format';

const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const range = ref<[string, string] | null>(null);

const query = reactive({ page: 1, pageSize: 10, keyword: '', status: '' });

async function load() {
  loading.value = true;
  try {
    const res = await adminOrders({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      startDate: range.value?.[0],
      endDate: range.value?.[1],
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

async function refund(row: any) {
  await ElMessageBox.confirm(
    `确定对订单 ${row.orderNo} 退款吗？退款后该用户的课程权限会被回收。`,
    '退款确认',
    { type: 'warning' },
  );
  await adminRefund(row.orderNo);
  ElMessage.success('已退款');
  load();
}

onMounted(load);
</script>
