<template>
  <div class="h-[calc(100vh-64px)] flex overflow-hidden">
    <!-- 会话列表 -->
    <aside
      class="w-[260px] bg-white border-r border-[#e8ecf3] flex flex-col shrink-0"
      :class="{ 'hidden lg:flex': !showSidebar }"
    >
      <div class="p-3 border-b border-[#e8ecf3]">
        <el-button type="primary" class="w-full" @click="newConversation">
          <el-icon class="mr-1"><Plus /></el-icon>新建对话
        </el-button>
      </div>

      <el-scrollbar class="flex-1">
        <div v-if="!conversations.length" class="text-center text-xs text-ink-500 py-10">
          还没有对话记录
        </div>
        <div
          v-for="c in conversations"
          :key="c.id"
          class="mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer group"
          :class="c.id === activeId ? 'bg-brand-50' : 'hover:bg-[#f7f9fc]'"
          @click="switchConversation(c.id)"
        >
          <div class="flex items-center gap-2">
            <el-avatar :size="22" :src="c.roleAvatar || ''">{{ c.roleName?.[0] }}</el-avatar>
            <span
              class="text-sm flex-1 line-clamp-1"
              :class="c.id === activeId ? 'text-brand-600 font-medium' : 'text-ink-900'"
            >
              {{ c.title }}
            </span>
            <el-icon
              class="opacity-0 group-hover:opacity-100 text-ink-500"
              @click.stop="removeConversation(c.id)"
            >
              <Delete />
            </el-icon>
          </div>
          <div class="text-xs text-ink-500 line-clamp-1 mt-1 pl-7">
            {{ c.lastMessage || '暂无消息' }}
          </div>
        </div>
      </el-scrollbar>
    </aside>

    <!-- 对话区 -->
    <div class="flex-1 flex flex-col min-w-0 bg-[#f5f7fb]">
      <!-- 顶栏 -->
      <div class="h-14 bg-white border-b border-[#e8ecf3] flex items-center px-4 gap-3 shrink-0">
        <el-icon class="lg:hidden cursor-pointer" @click="showSidebar = !showSidebar"><Expand /></el-icon>

        <template v-if="activeRole">
          <el-avatar :size="30" :src="activeRole.avatar || ''">{{ activeRole.name[0] }}</el-avatar>
          <div>
            <div class="text-sm font-medium text-ink-900">{{ activeRole.name }}</div>
            <div class="text-xs text-ink-500">{{ activeRole.description }}</div>
          </div>
        </template>
        <template v-else>
          <span class="text-sm text-ink-500">请选择一个 AI 角色开始对话</span>
        </template>

        <div class="ml-auto flex items-center gap-3">
          <el-tooltip content="开启后 AI 会先联网检索再作答（ReAct Agent）" placement="bottom">
            <div class="flex items-center gap-1 text-xs text-ink-500">
              <el-icon><Search /></el-icon>
              <el-switch v-model="enableSearch" size="small" :disabled="!activeRole?.enableSearch" />
              <span>联网搜索</span>
            </div>
          </el-tooltip>
        </div>
      </div>

      <!-- 角色选择（无会话时） -->
      <div v-if="!activeId" class="flex-1 overflow-auto p-6">
        <h2 class="elp-section-title mb-5">选择一个 AI 学习伙伴</h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="r in roles"
            :key="r.id"
            class="elp-card elp-card-hover p-5 cursor-pointer"
            @click="startWithRole(r)"
          >
            <div class="flex items-center gap-3 mb-3">
              <el-avatar :size="42" :src="r.avatar || ''">{{ r.name[0] }}</el-avatar>
              <div>
                <div class="font-medium text-ink-900">{{ r.name }}</div>
                <div class="text-xs text-ink-500">{{ r.category }}</div>
              </div>
            </div>
            <p class="text-xs text-ink-500 h-10 line-clamp-2">{{ r.description }}</p>
            <el-tag v-if="r.enableSearch" size="small" type="success" class="mt-2">支持联网</el-tag>
          </div>
        </div>
      </div>

      <!-- 消息流 -->
      <el-scrollbar v-else ref="scrollRef" class="flex-1">
        <div class="max-w-[820px] mx-auto px-4 py-6 space-y-5">
          <!-- 开场白 -->
          <div v-if="activeRole?.greeting && !messages.length" class="flex gap-3">
            <el-avatar :size="34" :src="activeRole.avatar || ''">{{ activeRole.name[0] }}</el-avatar>
            <div class="bg-white rounded-xl2 rounded-tl-sm px-4 py-3 shadow-card max-w-[80%] text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
              {{ activeRole.greeting }}
            </div>
          </div>

          <div
            v-for="m in messages"
            :key="m.id"
            class="flex gap-3"
            :class="m.role === 'user' ? 'flex-row-reverse' : ''"
          >
            <el-avatar
              :size="34"
              :src="m.role === 'user' ? userStore.userInfo?.avatar || '' : activeRole?.avatar || ''"
            >
              {{ m.role === 'user' ? userStore.userInfo?.nickname?.[0] : activeRole?.name?.[0] }}
            </el-avatar>

            <div class="max-w-[80%] min-w-0">
              <!-- 工具调用轨迹 -->
              <div v-if="m.toolCalls?.length" class="mb-2 space-y-1.5">
                <div
                  v-for="(t, i) in m.toolCalls"
                  :key="i"
                  class="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white border border-[#e8ecf3]"
                >
                  <el-icon class="text-brand-500">
                    <Loading v-if="t.status === 'running'" class="animate-spin" />
                    <Check v-else-if="t.status === 'success'" />
                    <Close v-else />
                  </el-icon>
                  <span class="text-ink-700">调用工具</span>
                  <code class="text-brand-600">{{ t.name }}</code>
                  <span v-if="t.costMs" class="text-ink-500 ml-auto">{{ t.costMs }}ms</span>
                </div>
              </div>

              <div
                class="rounded-xl2 px-4 py-3 text-sm leading-relaxed shadow-card"
                :class="
                  m.role === 'user'
                    ? 'bg-brand-500 text-white rounded-tr-sm'
                    : 'bg-white text-ink-700 rounded-tl-sm'
                "
              >
                <div
                  v-if="m.role === 'assistant'"
                  class="md-body"
                  :class="{ 'stream-cursor': streaming && m.id === streamingId }"
                  v-html="renderMarkdown(m.content || (streaming && m.id === streamingId ? '' : '（空回复）'))"
                ></div>
                <div v-else class="whitespace-pre-wrap">{{ m.content }}</div>
              </div>

              <div
                class="text-xs text-ink-500 mt-1"
                :class="m.role === 'user' ? 'text-right' : ''"
              >
                {{ fromNow(m.createdAt) }}
                <span v-if="m.tokens"> · {{ m.tokens }} tokens</span>
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>

      <!-- 输入区 -->
      <div v-if="activeId" class="bg-white border-t border-[#e8ecf3] p-4 shrink-0">
        <div class="max-w-[820px] mx-auto">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            resize="none"
            :disabled="streaming"
            placeholder="输入你的问题，Enter 发送，Shift + Enter 换行"
            @keydown.enter.exact.prevent="send"
          />
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-ink-500">
              <span v-if="streaming" class="text-brand-600">AI 正在思考…</span>
              <span v-else>{{ activeRole?.enableSearch && enableSearch ? '已开启联网搜索' : '未开启联网搜索' }}</span>
            </span>
            <div class="flex gap-2">
              <el-button v-if="streaming" type="danger" plain @click="stop">停止生成</el-button>
              <el-button type="primary" :loading="streaming" :disabled="!input.trim()" @click="send">
                发送
                <el-icon class="ml-1"><Promotion /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  listRoles,
} from '@/api/chat';
import { useUserStore } from '@/stores/user';
import { streamChat, type SSEHandle } from '@/utils/sse';
import { fromNow, renderMarkdown } from '@/utils/format';
import type { AiRole, ChatMessage, Conversation, ToolCallTrace } from '@elp/shared';

const route = useRoute();
const userStore = useUserStore();

const roles = ref<AiRole[]>([]);
const conversations = ref<Conversation[]>([]);
const messages = ref<ChatMessage[]>([]);
const activeId = ref<number | null>(null);
const activeRole = ref<AiRole | null>(null);
const input = ref('');
const streaming = ref(false);
const streamingId = ref<number>(-1);
const enableSearch = ref(true);
const showSidebar = ref(true);
const scrollRef = ref<any>(null);

let handle: SSEHandle | null = null;

function scrollToBottom() {
  nextTick(() => {
    const wrap = scrollRef.value?.wrapRef as HTMLElement | undefined;
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  });
}

async function loadRoles() {
  roles.value = await listRoles().catch(() => []);
}

async function loadConversations() {
  const res = await listConversations({ page: 1, pageSize: 50 });
  conversations.value = res.list;
}

async function newConversation() {
  if (!roles.value.length) {
    ElMessage.warning('暂无可用的 AI 角色，请联系管理员');
    return;
  }
  startWithRole(roles.value[0]);
}

async function startWithRole(role: AiRole) {
  const conv = await createConversation({ roleId: role.id });
  await loadConversations();
  await switchConversation(conv.id);
}

async function switchConversation(id: number) {
  activeId.value = id;
  const conv = conversations.value.find((c) => c.id === id);
  activeRole.value = roles.value.find((r) => r.id === conv?.roleId) ?? null;
  enableSearch.value = activeRole.value?.enableSearch ?? true;

  const res = await listMessages({ conversationId: id, page: 1, pageSize: 100 });
  messages.value = res.list.map((m) => ({ ...m, toolCalls: m.toolCalls ?? [] }));
  scrollToBottom();
}

async function removeConversation(id: number) {
  await ElMessageBox.confirm('确定删除该对话吗？', '提示', { type: 'warning' });
  await deleteConversation(id);
  if (activeId.value === id) {
    activeId.value = null;
    activeRole.value = null;
    messages.value = [];
  }
  await loadConversations();
}

/** 发送并订阅 SSE 流 */
function send() {
  const content = input.value.trim();
  if (!content || !activeId.value || streaming.value) return;

  input.value = '';
  streaming.value = true;
  streamingId.value = Date.now();

  // 本地先行渲染用户消息
  messages.value.push({
    id: -Date.now(),
    conversationId: activeId.value,
    role: 'user',
    content,
    toolCalls: [],
    createdAt: new Date().toISOString(),
  } as ChatMessage);

  // 占位的 assistant 消息（流式填充）
  const assistantMsg: ChatMessage = {
    id: streamingId.value,
    conversationId: activeId.value,
    role: 'assistant',
    content: '',
    toolCalls: [],
    createdAt: new Date().toISOString(),
  } as ChatMessage;
  messages.value.push(assistantMsg);
  scrollToBottom();

  handle = streamChat(
    '/chat/stream',
    { conversationId: activeId.value, content, enableSearch: enableSearch.value },
    {
      onDelta: (text) => {
        assistantMsg.content += text;
        // 触发响应式（数组内对象属性变更）
        messages.value = [...messages.value];
        scrollToBottom();
      },
      onTool: (tool: ToolCallTrace) => {
        const list = assistantMsg.toolCalls ?? (assistantMsg.toolCalls = []);
        const idx = list.findIndex((t) => t.name === tool.name && t.status === 'running');
        if (idx >= 0) list[idx] = { ...list[idx], ...tool };
        else list.push(tool);
        messages.value = [...messages.value];
        scrollToBottom();
      },
      onUsage: (usage) => {
        assistantMsg.tokens = usage.totalTokens;
      },
      onDone: () => {
        streaming.value = false;
        streamingId.value = -1;
        messages.value = [...messages.value];
        loadConversations();
      },
      onError: (msg) => {
        streaming.value = false;
        streamingId.value = -1;
        assistantMsg.content = assistantMsg.content || `（生成失败：${msg}）`;
        messages.value = [...messages.value];
        ElMessage.error(msg);
      },
    },
  );
}

function stop() {
  handle?.abort();
  streaming.value = false;
  streamingId.value = -1;
  ElMessage.info('已停止生成');
}

watch(
  () => route.query.roleId,
  async (roleId) => {
    if (!roleId) return;
    const role = roles.value.find((r) => r.id === Number(roleId));
    if (role) await startWithRole(role);
  },
);

onMounted(async () => {
  await loadRoles();
  await loadConversations();

  const roleId = route.query.roleId;
  if (roleId) {
    const role = roles.value.find((r) => r.id === Number(roleId));
    if (role) await startWithRole(role);
  } else if (conversations.value.length) {
    await switchConversation(conversations.value[0].id);
  }
});

onUnmounted(() => handle?.abort());
</script>
