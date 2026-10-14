<template>
  <div class="max-w-[1200px] mx-auto px-5 py-8">
    <div class="flex items-end justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-ink-900 mb-1">我的单词本</h1>
        <p class="text-sm text-ink-500">按艾宾浩斯遗忘曲线自动安排复习，答错重新计时</p>
      </div>
      <div class="flex gap-3">
        <el-button @click="importVisible = true"><el-icon class="mr-1"><Upload /></el-icon>批量导入</el-button>
        <el-button type="primary" :disabled="!stats?.due" @click="$router.push('/words/review')">
          开始复习
          <el-badge v-if="stats?.due" :value="stats.due" class="ml-1" />
        </el-button>
      </div>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div v-for="s in statCards" :key="s.label" class="elp-card p-4">
        <div class="text-xs text-ink-500 mb-1">{{ s.label }}</div>
        <div class="text-2xl font-bold" :style="{ color: s.color }">{{ s.value }}</div>
      </div>
    </div>

    <div class="grid lg:grid-cols-[240px_1fr] gap-6">
      <!-- 单词本列表 -->
      <div class="elp-card p-3 h-fit">
        <div class="flex items-center justify-between px-2 py-2 mb-1">
          <span class="text-sm font-medium text-ink-900">单词本</span>
          <el-icon class="cursor-pointer text-brand-600" @click="openBookDialog()"><Plus /></el-icon>
        </div>
        <div
          v-for="b in books"
          :key="b.id"
          class="px-3 py-2.5 rounded-lg cursor-pointer mb-1"
          :class="activeBookId === b.id ? 'bg-brand-50 text-brand-600' : 'hover:bg-[#f7f9fc] text-ink-700'"
          @click="selectBook(b.id)"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium line-clamp-1">{{ b.name }}</span>
            <el-dropdown v-if="!b.isDefault" trigger="click" @command="(c: string) => onBookCommand(c, b)">
              <el-icon class="text-ink-500" @click.stop><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="text-xs text-ink-500 mt-0.5">
            {{ b.mastered }}/{{ b.total }} 已掌握
          </div>
        </div>
      </div>

      <!-- 单词列表 -->
      <div class="elp-card p-5">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <el-input
            v-model="query.keyword"
            placeholder="搜索单词或释义"
            clearable
            class="!w-56"
            @keyup.enter="reload"
            @clear="reload"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>

          <el-select v-model="query.status" placeholder="全部状态" clearable class="!w-36" @change="reload">
            <el-option label="未学习" value="NEW" />
            <el-option label="学习中" value="LEARNING" />
            <el-option label="已掌握" value="MASTERED" />
          </el-select>

          <el-button
            type="danger"
            plain
            :disabled="!selection.length"
            @click="batchRemove"
          >
            删除选中 ({{ selection.length }})
          </el-button>

          <el-button type="primary" class="ml-auto" @click="openWordDialog()">
            <el-icon class="mr-1"><Plus /></el-icon>添加单词
          </el-button>
        </div>

        <el-table
          v-loading="loading"
          :data="words"
          row-key="id"
          @selection-change="(rows: any[]) => (selection = rows)"
        >
          <el-table-column type="selection" width="46" />
          <el-table-column prop="word" label="单词" min-width="140">
            <template #default="{ row }">
              <div class="font-medium text-ink-900">{{ row.word }}</div>
              <div class="text-xs text-ink-500">{{ row.phonetic }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="translation" label="释义" min-width="200" show-overflow-tooltip />
          <el-table-column prop="example" label="例句" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="text-ink-500 text-sm">{{ row.example || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="WORD_STATUS_LABEL[row.status]?.type as any">
                {{ WORD_STATUS_LABEL[row.status]?.text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="下次复习" width="120">
            <template #default="{ row }">
              <span class="text-xs text-ink-500">{{ formatDate(row.nextReviewAt, 'MM-DD HH:mm') }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="openWordDialog(row as Word)">编辑</el-button>
              <el-button text type="danger" size="small" @click="removeWord(row as Word)">删除</el-button>
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

    <!-- 单词编辑 -->
    <el-dialog v-model="wordDialog" :title="wordForm.id ? '编辑单词' : '添加单词'" width="520px">
      <el-form :model="wordForm" label-width="72px">
        <el-form-item label="单词" required>
          <el-input v-model="wordForm.word" placeholder="如 abandon" />
        </el-form-item>
        <el-form-item label="音标">
          <el-input v-model="wordForm.phonetic" placeholder="如 /əˈbændən/" />
        </el-form-item>
        <el-form-item label="释义" required>
          <el-input v-model="wordForm.translation" type="textarea" :rows="2" placeholder="v. 放弃；抛弃" />
        </el-form-item>
        <el-form-item label="例句">
          <el-input v-model="wordForm.example" placeholder="Never abandon your dream." />
        </el-form-item>
        <el-form-item label="例句翻译">
          <el-input v-model="wordForm.exampleZh" placeholder="永远不要放弃你的梦想。" />
        </el-form-item>
        <el-form-item label="所属">
          <el-select v-model="wordForm.bookId" class="w-full">
            <el-option v-for="b in books" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wordDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveWord">保存</el-button>
      </template>
    </el-dialog>

    <!-- 单词本编辑 -->
    <el-dialog v-model="bookDialog" :title="bookForm.id ? '重命名单词本' : '新建单词本'" width="420px">
      <el-form :model="bookForm" label-width="72px">
        <el-form-item label="名称" required>
          <el-input v-model="bookForm.name" placeholder="如 雅思核心词汇" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="bookForm.description" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bookDialog = false">取消</el-button>
        <el-button type="primary" @click="saveBook">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog v-model="importVisible" title="批量导入单词" width="620px">
      <el-alert
        type="info"
        :closable="false"
        title="每行一个单词，用英文逗号或 Tab 分隔"
        description="格式：单词,音标,释义,例句 —— 音标与例句可省略。也支持直接粘贴 Excel 两列（单词/释义）。"
        class="mb-3 !items-start"
      />
      <el-input
        v-model="importText"
        type="textarea"
        :rows="9"
        placeholder="abandon,/əˈbændən/,v. 放弃,Never abandon your dream.&#10;benefit,,n. 好处 v. 受益"
      />
      <div class="text-xs text-ink-500 mt-2">
        目标单词本：
        <el-select v-model="importBookId" size="small" class="!w-40">
          <el-option v-for="b in books" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="doImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  batchDeleteWords,
  createWord,
  createWordBook,
  deleteWord,
  deleteWordBook,
  importWords,
  listWordBooks,
  listWords,
  updateWord,
  updateWordBook,
  wordStats,
} from '@/api/word';
import { formatDate, WORD_STATUS_LABEL } from '@/utils/format';
import type { Word, WordBook } from '@elp/shared';

const books = ref<WordBook[]>([]);
const words = ref<Word[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const selection = ref<Word[]>([]);
const activeBookId = ref<number | undefined>(undefined);
const stats = ref<any>(null);

const query = reactive({ page: 1, pageSize: 10, keyword: '', status: '' });

const wordDialog = ref(false);
const bookDialog = ref(false);
const importVisible = ref(false);
const importing = ref(false);
const importText = ref('');
const importBookId = ref<number | undefined>(undefined);

const wordForm = reactive<any>({
  id: 0,
  bookId: undefined,
  word: '',
  phonetic: '',
  translation: '',
  example: '',
  exampleZh: '',
});

const bookForm = reactive<any>({ id: 0, name: '', description: '' });

const statCards = computed(() => [
  { label: '总词汇量', value: stats.value?.total ?? 0, color: '#12213a' },
  { label: '待复习', value: stats.value?.due ?? 0, color: '#e6a23c' },
  { label: '学习中', value: stats.value?.learning ?? 0, color: '#2f74ff' },
  { label: '已掌握', value: stats.value?.mastered ?? 0, color: '#22a06b' },
  { label: '掌握率', value: `${stats.value?.masteryRate ?? 0}%`, color: '#7c5cff' },
]);

async function loadBooks() {
  books.value = await listWordBooks();
  if (activeBookId.value === undefined && books.value.length) {
    activeBookId.value = books.value[0].id;
  }
  if (importBookId.value === undefined && books.value.length) {
    importBookId.value = books.value[0].id;
  }
}

async function loadWords() {
  loading.value = true;
  try {
    const res = await listWords({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      bookId: activeBookId.value,
    });
    words.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function reload() {
  query.page = 1;
  loadWords();
}

function onPage(p: number) {
  query.page = p;
  loadWords();
}

function selectBook(id: number) {
  activeBookId.value = id;
  reload();
}

function openWordDialog(row?: Word) {
  if (row) {
    Object.assign(wordForm, row);
  } else {
    Object.assign(wordForm, {
      id: 0,
      bookId: activeBookId.value ?? books.value[0]?.id,
      word: '',
      phonetic: '',
      translation: '',
      example: '',
      exampleZh: '',
    });
  }
  wordDialog.value = true;
}

async function saveWord() {
  if (!wordForm.word?.trim() || !wordForm.translation?.trim()) {
    ElMessage.warning('单词与释义不能为空');
    return;
  }
  saving.value = true;
  try {
    if (wordForm.id) {
      await updateWord(wordForm.id, { ...wordForm });
      ElMessage.success('已更新');
    } else {
      await createWord({ ...wordForm });
      ElMessage.success('已添加');
    }
    wordDialog.value = false;
    await Promise.all([loadWords(), refreshStats(), loadBooks()]);
  } finally {
    saving.value = false;
  }
}

async function removeWord(row: Word) {
  await ElMessageBox.confirm(`确定删除单词「${row.word}」吗？`, '提示', { type: 'warning' });
  await deleteWord(row.id);
  ElMessage.success('已删除');
  await Promise.all([loadWords(), refreshStats(), loadBooks()]);
}

async function batchRemove() {
  await ElMessageBox.confirm(`确定删除选中的 ${selection.value.length} 个单词吗？`, '提示', {
    type: 'warning',
  });
  const res = await batchDeleteWords(selection.value.map((w) => w.id));
  ElMessage.success(`已删除 ${res.deleted} 个单词`);
  selection.value = [];
  await Promise.all([loadWords(), refreshStats(), loadBooks()]);
}

function openBookDialog(book?: WordBook) {
  if (book) Object.assign(bookForm, { id: book.id, name: book.name, description: book.description });
  else Object.assign(bookForm, { id: 0, name: '', description: '' });
  bookDialog.value = true;
}

async function saveBook() {
  if (!bookForm.name?.trim()) {
    ElMessage.warning('请填写单词本名称');
    return;
  }
  if (bookForm.id) await updateWordBook(bookForm.id, { name: bookForm.name, description: bookForm.description });
  else await createWordBook({ name: bookForm.name, description: bookForm.description });
  ElMessage.success('已保存');
  bookDialog.value = false;
  await loadBooks();
}

async function onBookCommand(cmd: string, book: WordBook) {
  if (cmd === 'edit') {
    openBookDialog(book);
    return;
  }
  await ElMessageBox.confirm(`删除单词本「${book.name}」将同时删除其中所有单词，确定吗？`, '警告', {
    type: 'warning',
  });
  await deleteWordBook(book.id);
  ElMessage.success('已删除');
  if (activeBookId.value === book.id) activeBookId.value = undefined;
  await Promise.all([loadBooks(), loadWords(), refreshStats()]);
}

async function doImport() {
  const lines = importText.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    ElMessage.warning('请输入要导入的内容');
    return;
  }

  const items = lines.map((line) => {
    const parts = line.split(/[,\t]/).map((s) => s.trim());
    return {
      word: parts[0] ?? '',
      phonetic: parts[1] || undefined,
      translation: parts[2] || parts[1] || '',
      example: parts[3] || undefined,
    };
  });

  importing.value = true;
  try {
    const res = await importWords({ bookId: importBookId.value!, words: items });
    ElMessage.success(`导入成功 ${res.imported} 个，跳过 ${res.skipped} 个（重复）`);
    importVisible.value = false;
    importText.value = '';
    await Promise.all([loadWords(), loadBooks(), refreshStats()]);
  } finally {
    importing.value = false;
  }
}

async function refreshStats() {
  stats.value = await wordStats().catch(() => null);
}

onMounted(async () => {
  await loadBooks();
  await Promise.all([loadWords(), refreshStats()]);
});
</script>
