<template>
  <div class="elp-card p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="elp-section-title">公告管理</h2>
      <el-button type="primary" @click="openEdit()">
        <el-icon class="mr-1"><Plus /></el-icon>发布公告
      </el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      title="发布后即时广播"
      description="公告发布后，会通过 Socket.IO 向所有在线用户实时推送系统通知。"
      class="mb-4 !items-start"
    />

    <el-table v-loading="loading" :data="list">
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="typeTag(row.type)">{{ typeText(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.published ? 'success' : 'info'">
            {{ row.published ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发布时间" width="150">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatDate(row.createdAt, 'MM-DD HH:mm') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button text type="danger" size="small" @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="editVisible" :title="form.id ? '编辑公告' : '发布公告'" width="560px">
      <el-form :model="form" label-width="70px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="公告标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" class="w-full">
            <el-option label="系统通知" value="SYSTEM" />
            <el-option label="活动公告" value="ACTIVITY" />
            <el-option label="课程更新" value="COURSE" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="公告内容" />
        </el-form-item>
        <el-form-item label="立即发布">
          <el-switch v-model="form.published" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminCreateNotice, adminDeleteNotice, adminNotices, adminUpdateNotice } from '@/api/admin';
import { formatDate } from '@/utils/format';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const saving = ref(false);
const editVisible = ref(false);

const form = reactive<any>({ id: 0, title: '', content: '', type: 'SYSTEM', published: true });

const typeText = (t: string) => ({ SYSTEM: '系统', ACTIVITY: '活动', COURSE: '课程' })[t] ?? t;
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const typeTag = (t: string): TagType =>
  (({ SYSTEM: 'info', ACTIVITY: 'warning', COURSE: 'success' }) as Record<string, TagType>)[t] ?? 'info';

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const res = await adminNotices({ page: p, pageSize: pageSize.value });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function openEdit(row?: any) {
  if (row) Object.assign(form, row);
  else Object.assign(form, { id: 0, title: '', content: '', type: 'SYSTEM', published: true });
  editVisible.value = true;
}

async function save() {
  if (!form.title?.trim() || !form.content?.trim()) {
    ElMessage.warning('标题与内容不能为空');
    return;
  }
  saving.value = true;
  try {
    if (form.id) await adminUpdateNotice(form.id, form);
    else await adminCreateNotice(form);
    ElMessage.success('已保存');
    editVisible.value = false;
    load(1);
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除公告「${row.title}」吗？`, '警告', { type: 'warning' });
  await adminDeleteNotice(row.id);
  ElMessage.success('已删除');
  load();
}

onMounted(() => load(1));
</script>
