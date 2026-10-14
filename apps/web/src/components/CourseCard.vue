<template>
  <div
    class="elp-card elp-card-hover overflow-hidden cursor-pointer group"
    @click="$emit('click')"
  >
    <div class="h-40 bg-ink-100 overflow-hidden relative">
      <img
        v-if="course.cover"
        :src="course.cover"
        :alt="course.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      <div
        v-else
        class="w-full h-full grid place-items-center bg-gradient-to-br from-brand-400 to-brand-700 text-white text-3xl font-bold"
      >
        {{ course.title?.[0] ?? 'E' }}
      </div>
      <el-tag
        size="small"
        class="absolute top-3 left-3 !border-0"
        :type="course.level === 'ADVANCED' ? 'danger' : course.level === 'INTERMEDIATE' ? 'warning' : 'success'"
      >
        {{ LEVEL_LABEL[course.level] ?? course.level }}
      </el-tag>
    </div>

    <div class="p-4">
      <h3 class="font-semibold text-ink-900 line-clamp-1 mb-1">{{ course.title }}</h3>
      <p class="text-xs text-ink-500 line-clamp-2 h-9 mb-3">{{ course.subtitle || '暂无简介' }}</p>

      <div class="flex items-center gap-3 text-xs text-ink-500 mb-3">
        <span class="flex items-center gap-1"><el-icon><User /></el-icon>{{ course.studentCount }}</span>
        <span class="flex items-center gap-1"><el-icon><VideoPlay /></el-icon>{{ course.lessonCount }} 节</span>
        <span class="flex items-center gap-1">
          <el-icon color="#e6a23c"><StarFilled /></el-icon>{{ course.rating }}
        </span>
      </div>

      <div class="flex items-end justify-between">
        <div>
          <span class="text-lg font-bold text-[#f56c6c]">¥{{ fen2yuan(course.price) }}</span>
          <span
            v-if="course.originalPrice && course.originalPrice > course.price"
            class="text-xs text-ink-500 line-through ml-1"
          >
            ¥{{ fen2yuan(course.originalPrice) }}
          </span>
        </div>
        <span class="text-xs text-ink-500">{{ course.teacher || '平台讲师' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Course } from '@elp/shared';
import { fen2yuan, LEVEL_LABEL } from '@/utils/format';

defineProps<{ course: Course }>();
defineEmits<{ click: [] }>();
</script>
