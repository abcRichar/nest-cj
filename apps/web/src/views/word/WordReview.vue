<template>
  <div class="max-w-[760px] mx-auto px-5 py-8">
    <div class="flex items-center gap-3 mb-6">
      <el-button text @click="$router.push('/words')"><el-icon><ArrowLeft /></el-icon>返回单词本</el-button>
      <div class="ml-auto text-sm text-ink-500">
        <span v-if="!finished">{{ index + 1 }} / {{ queue.length }}</span>
        <span v-else>本轮完成</span>
      </div>
    </div>

    <el-progress
      v-if="queue.length"
      :percentage="Math.round((index / queue.length) * 100)"
      :stroke-width="6"
      :show-text="false"
      class="mb-6"
    />

    <!-- 复习中 -->
    <template v-if="!finished && current">
      <div
        class="elp-card p-8 text-center cursor-pointer select-none min-h-[320px] flex flex-col justify-center"
        @click="revealed = true"
      >
        <div class="text-4xl font-bold text-ink-900 mb-3">{{ current.word }}</div>
        <div class="text-sm text-ink-500 mb-6">{{ current.phonetic || '　' }}</div>

        <transition name="fade-slide">
          <div v-if="revealed">
            <el-divider />
            <div class="text-lg text-ink-900 mb-3">{{ current.translation }}</div>
            <div v-if="current.example" class="text-sm text-ink-500 italic">“{{ current.example }}”</div>
            <div v-if="current.exampleZh" class="text-xs text-ink-500 mt-1">{{ current.exampleZh }}</div>
          </div>
          <div v-else class="text-xs text-ink-500 mt-2">点击卡片查看释义</div>
        </transition>
      </div>

      <div class="flex gap-4 mt-6">
        <el-button
          size="large"
          class="flex-1 !h-12"
          :disabled="!revealed"
          @click="answer(false)"
        >
          <el-icon class="mr-1"><Close /></el-icon>不认识
        </el-button>
        <el-button
          type="primary"
          size="large"
          class="flex-1 !h-12"
          :disabled="!revealed"
          @click="answer(true)"
        >
          <el-icon class="mr-1"><Check /></el-icon>认识
        </el-button>
      </div>

      <div class="text-center text-xs text-ink-500 mt-4">
        答错会重置该单词的复习周期；连续答对 5 次判定为已掌握
      </div>
    </template>

    <!-- 完成 -->
    <template v-else>
      <div class="elp-card p-10 text-center">
        <el-icon :size="56" color="#22a06b" class="mb-4"><CircleCheckFilled /></el-icon>
        <h2 class="text-xl font-bold text-ink-900 mb-2">
          {{ queue.length ? '本轮复习完成！' : '暂时没有需要复习的单词' }}
        </h2>
        <p class="text-sm text-ink-500 mb-6">
          <template v-if="queue.length">
            共复习 {{ queue.length }} 个，答对 {{ correctCount }} 个，正确率
            {{ Math.round((correctCount / queue.length) * 100) }}%
          </template>
          <template v-else>去单词本添加一些单词，明天再来复习吧</template>
        </p>

        <div class="flex gap-3 justify-center">
          <el-button @click="restart">再来一轮</el-button>
          <el-button type="primary" @click="$router.push('/words')">返回单词本</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { reviewWord, todayQueue } from '@/api/word';
import type { Word } from '@elp/shared';

const queue = ref<Word[]>([]);
const index = ref(0);
const correctCount = ref(0);
const revealed = ref(false);
const finished = ref(false);
let startAt = Date.now();

const current = computed(() => queue.value[index.value] ?? null);

async function load() {
  const res = await todayQueue(20);
  queue.value = res.list;
  index.value = 0;
  correctCount.value = 0;
  finished.value = res.list.length === 0;
  revealed.value = false;
  startAt = Date.now();
}

async function answer(correct: boolean) {
  const word = current.value;
  if (!word) return;

  const cost = Date.now() - startAt;
  // 本地先推进，避免等待请求造成卡顿
  index.value += 1;
  if (correct) correctCount.value += 1;
  revealed.value = false;
  startAt = Date.now();

  try {
    await reviewWord({ wordId: word.id, correct, cost });
  } catch {
    /* 忽略单次上报失败 */
  }

  if (index.value >= queue.value.length) {
    finished.value = true;
    ElMessage.success('本轮复习完成');
  }
}

function restart() {
  load();
}

onMounted(load);
</script>
