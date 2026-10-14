<template>
  <div>
    <div class="elp-card p-5 mb-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="elp-section-title">AI 角色管理</h2>
        <el-button type="primary" @click="openEdit()">
          <el-icon class="mr-1"><Plus /></el-icon>新建角色
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column label="角色" min-width="200">
          <template #default="{ row }">
            <div class="flex items-center gap-3">
              <el-avatar :size="38" :src="row.avatar || ''">{{ row.name[0] }}</el-avatar>
              <div>
                <div class="font-medium text-ink-900">{{ row.name }}</div>
                <div class="text-xs text-ink-500">code: {{ row.code }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="联网" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enableSearch ? 'success' : 'info'">
              {{ row.enableSearch ? '开' : '关' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="会话数" width="90">
          <template #default="{ row }">{{ row.conversationCount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'danger'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="warning" size="small" @click="toggle(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-button text type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 会话列表 -->
    <div class="elp-card p-5">
      <h2 class="elp-section-title mb-4">全站会话记录</h2>
      <el-table v-loading="convLoading" :data="conversations">
        <el-table-column label="用户" width="140">
          <template #default="{ row }">
            <span class="text-sm">{{ row.user?.nickname }} (@{{ row.user?.username }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="会话标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">{{ row.role?.name }}</template>
        </el-table-column>
        <el-table-column prop="messageCount" label="消息数" width="90" />
        <el-table-column label="最后活跃" width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatDate(row.updatedAt, 'MM-DD HH:mm') }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end mt-4">
        <el-pagination
          layout="prev, pager, next, total"
          :total="convTotal"
          :page-size="convPageSize"
          :current-page="convPage"
          background
          @current-change="loadConversations"
        />
      </div>
    </div>

    <!-- 编辑角色 -->
    <el-dialog v-model="editVisible" :title="form.id ? '编辑 AI 角色' : '新建 AI 角色'" width="640px">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="角色名称" required>
              <el-input v-model="form.name" placeholder="如：口语教练 Lucy" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色编码" required>
              <el-input v-model="form.code" placeholder="oral-coach（唯一）" :disabled="!!form.id" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="头像地址">
          <el-input v-model="form.avatar" placeholder="https://..." />
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-input v-model="form.category" placeholder="general / oral / grammar" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="联网">
              <el-switch v-model="form.enableSearch" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="排序">
              <el-input-number v-model="form.sort" :min="0" class="!w-full" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="角色描述">
          <el-input v-model="form.description" placeholder="一句话描述这个角色的定位" />
        </el-form-item>

        <el-form-item label="开场白">
          <el-input v-model="form.greeting" type="textarea" :rows="2" placeholder="进入对话时展示的第一句话" />
        </el-form-item>

        <el-form-item label="System Prompt" required>
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="7"
            placeholder="定义角色的身份、语气、回答要求和边界"
          />
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
import {
  adminAiRoles,
  adminConversations,
  adminCreateAiRole,
  adminDeleteAiRole,
  adminToggleAiRole,
  adminUpdateAiRole,
} from '@/api/chat';
import { formatDate } from '@/utils/format';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const editVisible = ref(false);

const conversations = ref<any[]>([]);
const convLoading = ref(false);
const convTotal = ref(0);
const convPage = ref(1);
const convPageSize = ref(10);

const form = reactive<any>({
  id: 0,
  code: '',
  name: '',
  avatar: '',
  description: '',
  systemPrompt: '',
  greeting: '',
  category: 'general',
  enableSearch: true,
  sort: 0,
});

async function load() {
  loading.value = true;
  try {
    list.value = await adminAiRoles();
  } finally {
    loading.value = false;
  }
}

async function loadConversations(page = convPage.value) {
  convPage.value = page;
  convLoading.value = true;
  try {
    const res = await adminConversations({ page, pageSize: convPageSize.value });
    conversations.value = res.list;
    convTotal.value = res.total;
  } finally {
    convLoading.value = false;
  }
}

function openEdit(row?: any) {
  if (row) {
    Object.assign(form, row);
  } else {
    Object.assign(form, {
      id: 0,
      code: '',
      name: '',
      avatar: '',
      description: '',
      systemPrompt: '',
      greeting: '',
      category: 'general',
      enableSearch: true,
      sort: (list.value.length + 1) * 10,
    });
  }
  editVisible.value = true;
}

async function save() {
  if (!form.name?.trim() || !form.systemPrompt?.trim() || (!form.id && !form.code?.trim())) {
    ElMessage.warning('名称、编码与 System Prompt 均为必填');
    return;
  }
  saving.value = true;
  try {
    if (form.id) await adminUpdateAiRole(form.id, form);
    else await adminCreateAiRole(form);
    ElMessage.success('已保存');
    editVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggle(row: any) {
  await adminToggleAiRole(row.id);
  ElMessage.success('已切换状态');
  load();
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？`, '警告', { type: 'warning' });
  const res: any = await adminDeleteAiRole(row.id);
  ElMessage.success(res?.message ?? '已删除');
  load();
}

onMounted(() => {
  load();
  loadConversations(1);
});
</script>
