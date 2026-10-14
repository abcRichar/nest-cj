import { get, post } from './http';
import type { PageResult, StudyOverview, StudyRecord } from '@elp/shared';

export const reportProgress = (data: {
  courseId: number;
  lessonId: number;
  duration: number;
  progress?: number;
}) => post('/study/report', data);

export const studyOverview = () => get<StudyOverview>('/study/overview');

export const studyRecords = (params: { page?: number; pageSize?: number }) =>
  get<PageResult<StudyRecord & { courseTitle: string; lessonTitle: string }>>('/study/records', params);

export const courseProgress = (courseId: number) =>
  get<{
    courseId: number;
    progress: number;
    lastLessonId: number | null;
    lessons: Array<{ lessonId: number; progress: number }>;
  }>(`/study/course/${courseId}`);

export const myReports = (limit = 10) => get<any[]>('/reports/mine', { limit });
