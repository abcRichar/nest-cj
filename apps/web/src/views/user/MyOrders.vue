<template>
  <div class="elp-card p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="elp-section-title">我的订单</h2>
      <el-radio-group v-model="status" size="small" @change="reload">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button label="PENDING">待支付</el-radio-button>
        <el-radio-button label="PAID">已支付</el-radio-button>
        <el-radio-button label="REFUNDED">已退款</el-radio-button>
      </el-radio-group>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column label="课程" min-width="220">
        <template #default="{ row }">
          <div class="flex items-center gap-3">
            <div class="w-14 h-10 rounded-md overflow-hidden bg-ink-100 shrink-0">
              <img v-if="row.courseCover" :src="row.courseCover" class="w-full h-full object-cover" />
            </div>
            <span class="text-sm text-ink-900 line-clamp-1">{{ row.courseTitle }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="200">
        <template #default="{ row }">
          <span class="text-xs text-ink-500 break-all">{{ row.orderNo }}</span>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="100">
        <template #default="{ row }">
          <span class="font-medium text-[#f56c6c]">¥{{ fen2yuan(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="ORDER_STATUS_LABEL[row.status]?.type as any">
            {{ ORDER_STATUS_LABEL[row.status]?.text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下单时间" width="150">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatDate(row.createdAt, 'YYYY-MM-DD HH:mm') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'PENDING'">
            <el-button text type="primary" size="small" @click="gotoPay(row as Order)">去支付</el-button>
            <el-button text type="danger" size="small" @click="cancel(row as Order)">取消</el-button>
          </template>
          <el-button v-else-if="row.status === 'PAID'" text type="primary" size="small" @click="$router.push(`/study/${row.courseId}`)">
            去学习
          </el-button>
          <span v-else class="text-xs text-ink-500">-</span>
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
        @current-change="onPage"
      />
    </div>

    <!-- 支付弹窗 -->
    <el-dialog v-model="payVisible" title="订单支付" width="420px">
      <div v-if="payInfo" class="text-center">
        <div class="text-xs text-ink-500 mb-1">订单号</div>
        <div class="text-xs text-ink-700 mb-3 break-all">{{ payInfo.orderNo }}</div>
        <div class="text-2xl font-bold text-[#f56c6c] mb-4">¥{{ fen2yuan(payInfo.amount) }}</div>
        <el-alert v-if="payInfo.mock" type="warning" :closable="false" title="Mock 支付模式" class="mb-4 !items-start" />
        <div class="flex gap-3 justify-center">
          <el-button type="primary" @click="openCashier">打开收银台</el-button>
          <el-button :loading="syncing" @click="syncNow">同步状态</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { cancelOrder, getPayForm, listOrders, syncOrder } from '@/api/order';
import { SOCKET_EVENTS, type Order } from '@elp/shared';
import { useSocket } from '@/utils/socket';
import { fen2yuan, formatDate, ORDER_STATUS_LABEL } from '@/utils/format';

const socket = useSocket();
const list = ref<Order[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const status = ref('');
const loading = ref(false);
const syncing = ref(false);
const payVisible = ref(false);
const payInfo = ref<{ orderNo: string; payForm: string; amount: number; mock: boolean } | null>(null);
let off: (() => void) | null = null;

async function load() {
  loading.value = true;
  try {
    const res = await listOrders({
      page: page.value,
      pageSize: pageSize.value,
      status: status.value || undefined,
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function reload() {
  page.value = 1;
  load();
}

function onPage(p: number) {
  page.value = p;
  load();
}

async function gotoPay(row: Order) {
  payInfo.value = await getPayForm(row.orderNo);
  payVisible.value = true;
}

function openCashier() {
  if (!payInfo.value) return;
  const win = window.open('', '_blank', 'width=420,height=640');
  if (!win) {
    ElMessage.warning('请允许浏览器弹出窗口');
    return;
  }
  win.document.write(payInfo.value.payForm);
  win.document.close();
}

async function syncNow() {
  if (!payInfo.value) return;
  syncing.value = true;
  try {
    const o = await syncOrder(payInfo.value.orderNo);
    if (o.status === 'PAID') {
      ElMessage.success('支付成功');
      payVisible.value = false;
      load();
    } else {
      ElMessage.info('暂未查询到支付成功记录');
    }
  } finally {
    syncing.value = false;
  }
}

async function cancel(row: Order) {
  await ElMessageBox.confirm('确定取消该订单吗？', '提示', { type: 'warning' });
  await cancelOrder(row.orderNo);
  ElMessage.success('已取消');
  load();
}

onMounted(() => {
  load();
  off = socket.on(SOCKET_EVENTS.PAYMENT_RESULT, (payload: any) => {
    if (payload?.status === 'PAID') {
      ElMessage.success(payload.message ?? '支付成功');
      payVisible.value = false;
      load();
    }
  });
});

onUnmounted(() => off?.());
</script>
