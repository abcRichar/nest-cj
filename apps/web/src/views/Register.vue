<template>
  <div class="min-h-screen flex items-center justify-center bg-[#f5f7fb] p-6">
    <div class="w-full max-w-[440px]">
      <div class="text-center mb-7">
        <div
          class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white grid place-items-center font-bold text-xl mx-auto mb-3"
        >
          L
        </div>
        <h1 class="text-2xl font-bold text-ink-900 mb-1">创建账号</h1>
        <p class="text-sm text-ink-500">注册即送入门单词本与 AI 体验额度</p>
      </div>

      <div class="elp-card p-7">
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="onSubmit">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="用户名（字母/数字/下划线）" clearable>
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="email">
            <el-input v-model="form.email" placeholder="邮箱（用于接收学习日报）" clearable>
              <template #prefix><el-icon><Message /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码（6-32 位）" show-password>
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="confirm">
            <el-input
              v-model="form.confirm"
              type="password"
              placeholder="确认密码"
              show-password
              @keyup.enter="onSubmit"
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-button type="primary" class="w-full" :loading="loading" @click="onSubmit">
            注册并登录
          </el-button>
        </el-form>

        <div class="mt-5 text-center text-sm text-ink-500">
          已有账号？
          <el-link type="primary" :underline="false" @click="$router.push('/login')">去登录</el-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useSocket } from '@/utils/socket';

const router = useRouter();
const userStore = useUserStore();
const socket = useSocket();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ username: '', email: '', password: '', confirm: '' });

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度 3-20 位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字、下划线', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度 6-32 位', trigger: 'blur' },
  ],
  confirm: [
    {
      validator: (_r, value, cb) => {
        if (!value) return cb(new Error('请再次输入密码'));
        if (value !== form.password) return cb(new Error('两次输入的密码不一致'));
        cb();
      },
      trigger: 'blur',
    },
  ],
};

async function onSubmit() {
  const ok = await formRef.value?.validate().catch(() => false);
  if (!ok) return;

  loading.value = true;
  try {
    const res = await userStore.register({
      username: form.username,
      email: form.email,
      password: form.password,
    });
    socket.connect(res.token);
    ElMessage.success('注册成功，已为你创建默认单词本');
    router.replace('/');
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}
</script>
