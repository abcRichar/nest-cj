<template>
  <div class="min-h-screen grid place-items-center bg-[#0f1b2d] p-6">
    <div class="w-full max-w-[380px]">
      <div class="text-center mb-7">
        <div
          class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white grid place-items-center font-bold text-xl mx-auto mb-3"
        >
          L
        </div>
        <h1 class="text-xl font-bold text-white mb-1">LinguaFlow 管理后台</h1>
        <p class="text-xs text-white/50">仅限管理员账号登录</p>
      </div>

      <div class="bg-white rounded-xl2 p-7 shadow-hover">
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="onSubmit">
          <el-form-item prop="account">
            <el-input v-model="form.account" placeholder="管理员账号" clearable>
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
          <el-button type="primary" class="w-full" :loading="loading" @click="onSubmit">
            登录管理后台
          </el-button>
        </el-form>

        <div class="mt-4 text-center">
          <el-link type="primary" :underline="false" @click="fillDemo">填充演示管理员账号</el-link>
        </div>
      </div>

      <div class="text-center mt-6">
        <el-link :underline="false" class="!text-white/50 text-xs" @click="$router.push('/')">
          返回前台首页
        </el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ account: '', password: '' });

const rules = {
  account: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少 6 位', trigger: 'blur' }],
};

function fillDemo() {
  form.account = 'admin';
  form.password = 'admin123';
  ElMessage.info('已填入演示管理员账号：admin / admin123');
}

async function onSubmit() {
  const ok = await formRef.value?.validate().catch(() => false);
  if (!ok) return;

  loading.value = true;
  try {
    const res = await userStore.adminLogin(form.account, form.password);
    ElMessage.success(`欢迎，${res.user.nickname}`);
    router.replace((route.query.redirect as string) || '/admin/dashboard');
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}
</script>
