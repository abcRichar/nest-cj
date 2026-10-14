<template>
  <div>
    <!-- 学习总览 -->
    <div class="elp-card p-5 mb-5">
      <h2 class="elp-section-title mb-4">学习概览</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="c in cards" :key="c.label" class="rounded-xl2 bg-[#f7f9fc] p-4">
          <div class="text-xs text-ink-500 mb-1">{{ c.label }}</div>
          <div class="text-xl font-bold" :style="{ color: c.color }">{{ c.value }}</div>
        </div>
      </div>

      <div class="mt-5">
        <div class="text-xs text-ink-500 mb-2">近 7 天学习时长</div>
        <div class="flex items-end gap-2 h-24">
          <div
            v-for="d in overview?.weekTrend ?? []"
            :key="d.date"
            class="flex-1 flex flex-col items-center gap-1"
          >
            <div
              class="w-full rounded-t-md bg-gradient-to-t from-brand-300 to-brand-500 transition-all"
              :style="{ height: `${barHeight(d.duration)}%`, minHeight: '4px' }"
            ></div>
            <span class="text-[10px] text-ink-500">{{ d.date.slice(5) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 资料编辑 -->
    <div class="elp-card p-5 mb-5">
      <h2 class="elp-section-title mb-4">个人资料</h2>
      <el-form :model="form" label-width="80px" class="max-w-[460px]">
        <el-form-item label="用户名">
          <el-input :model-value="userStore.userInfo?.username" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="昵称" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input :model-value="userStore.userInfo?.email" disabled />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="手机号（密文存储）" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.bio" type="textarea" :rows="2" placeholder="一句话介绍自己" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存修改</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 修改密码 -->
    <div class="elp-card p-5">
      <h2 class="elp-section-title mb-4">修改密码</h2>
      <el-alert
        type="info"
        :closable="false"
        title="该接口启用了签名校验"
        description="前端会对请求做 HMAC-SHA256 签名，服务端 SignGuard 验签通过后才处理，防止参数被篡改。"
        class="mb-4 !items-start"
      />
      <el-form :model="pwd" label-width="80px" class="max-w-[460px]">
        <el-form-item label="原密码">
          <el-input v-model="pwd.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwd.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="changing" @click="changePwd">确认修改</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { changePassword, updateProfile } from '@/api/auth';
import { studyOverview } from '@/api/study';
import { wordStats } from '@/api/word';
import { useUserStore } from '@/stores/user';
import { formatDuration } from '@/utils/format';
import type { StudyOverview } from '@elp/shared';

const userStore = useUserStore();
const overview = ref<StudyOverview | null>(null);
const wordStat = ref<any>(null);
const saving = ref(false);
const changing = ref(false);

const form = reactive({ nickname: '', phone: '', bio: '' });
const pwd = reactive({ oldPassword: '', newPassword: '' });

const cards = computed(() => [
  { label: '累计学习', value: overview.value ? formatDuration(overview.value.totalDuration) : '-', color: '#2f74ff' },
  { label: '学习天数', value: overview.value?.studyDays ?? 0, color: '#22a06b' },
  { label: '已购课程', value: overview.value?.courseCount ?? 0, color: '#e6a23c' },
  { label: '已掌握单词', value: wordStat.value?.mastered ?? 0, color: '#7c5cff' },
]);

function barHeight(seconds: number) {
  const max = Math.max(...(overview.value?.weekTrend ?? []).map((t) => t.duration), 60);
  return Math.max(4, Math.round((seconds / max) * 100));
}

async function save() {
  saving.value = true;
  try {
    await updateProfile({ ...form });
    await userStore.fetchProfile();
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
}

async function changePwd() {
  if (!pwd.oldPassword || pwd.newPassword.length < 6) {
    ElMessage.warning('请填写完整，新密码至少 6 位');
    return;
  }
  changing.value = true;
  try {
    await changePassword({ ...pwd });
    ElMessage.success('密码已修改，请重新登录');
    pwd.oldPassword = '';
    pwd.newPassword = '';
  } finally {
    changing.value = false;
  }
}

onMounted(async () => {
  form.nickname = userStore.userInfo?.nickname ?? '';
  form.bio = userStore.userInfo?.bio ?? '';
  overview.value = await studyOverview().catch(() => null);
  wordStat.value = await wordStats().catch(() => null);
});
</script>
