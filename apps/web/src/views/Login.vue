<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-[#f5f7fb]">
    <!-- 左侧品牌区 -->
    <div class="hidden lg:flex flex-col justify-between bg-[#0f1b2d] text-white p-12 relative overflow-hidden">
      <div
        class="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-600/25 blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-brand-400/15 blur-3xl pointer-events-none"
      ></div>

      <div class="flex items-center gap-2 relative">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center font-bold">
          L
        </div>
        <span class="text-lg font-bold">LinguaFlow</span>
      </div>

      <div class="relative">
        <h2 class="text-3xl font-bold leading-snug mb-4">
          每天 20 分钟<br />让英语真正长在你身上
        </h2>
        <p class="text-white/60 leading-relaxed">
          课程 · 单词 · AI 对话三位一体，<br />
          学习数据自动沉淀为成长报告。
        </p>
      </div>

      <div class="text-white/40 text-xs relative">
        Monorepo 全栈实践 · Vue3 + NestJS + LangGraph
      </div>
    </div>

    <!-- 右侧表单 -->
    <div class="flex items-center justify-center p-6">
      <div class="w-full max-w-[400px]">
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-ink-900 mb-2">欢迎回来</h1>
          <p class="text-sm text-ink-500">登录后继续你的学习进度</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="onSubmit">
          <el-form-item prop="account">
            <el-input v-model="form.account" placeholder="用户名或邮箱" clearable>
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              show-password
              @keyup.enter="onSubmit"
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>

          <div class="flex items-center justify-between mb-5 text-sm">
            <el-checkbox v-model="remember">记住我</el-checkbox>
            <el-link type="primary" :underline="false" @click="fillDemo">使用演示账号</el-link>
          </div>

          <el-button type="primary" class="w-full" :loading="loading" @click="onSubmit">
            登录
          </el-button>
        </el-form>

        <div class="mt-6 text-center text-sm text-ink-500">
          还没有账号？
          <el-link type="primary" :underline="false" @click="$router.push('/register')">
            立即注册
          </el-link>
        </div>

        <el-divider>
          <span class="text-xs text-ink-500">其他</span>
        </el-divider>

        <div class="flex justify-center">
          <el-button text @click="$router.push('/')">
            <el-icon class="mr-1"><HomeFilled /></el-icon>先逛逛再说
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useSocket } from '@/utils/socket';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const socket = useSocket();

const formRef = ref<FormInstance>();
const loading = ref(false);
const remember = ref(true);

const form = reactive({ account: '', password: '' });

const rules = {
  account: [{ required: true, message: '请输入用户名或邮箱', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少 6 位', trigger: 'blur' }],
};

function fillDemo() {
  form.account = 'demo';
  form.password = '123456';
  ElMessage.info('已填入演示账号：demo / 123456');
}

async function onSubmit() {
  const ok = await formRef.value?.validate().catch(() => false);
  if (!ok) return;

  loading.value = true;
  try {
    const res = await userStore.login(form.account, form.password);
    socket.connect(res.token);
    ElMessage.success(`欢迎回来，${res.user.nickname}`);
    const redirect = (route.query.redirect as string) || '/';
    router.replace(redirect);
  } catch {
    /* 错误提示由 http 拦截器统一处理 */
  } finally {
    loading.value = false;
  }
}
</script>
