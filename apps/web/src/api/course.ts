import { get, post, put, patch, del } from './http';
import type {
  Course,
  CourseCategory,
  CourseChapter,
  CourseLesson,
  MyCourse,
  PageResult,
} from '@elp/shared';

export interface CourseDetail extends Course {
  chapters: Array<CourseChapter & { lessons: CourseLesson[] }>;
  purchased: boolean;
  progress: number;
  lastLessonId: number | null;
}

export const listCourses = (params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  level?: string;
  sortBy?: string;
}) => get<PageResult<Course>>('/courses', params);

export const courseCategories = () => get<CourseCategory[]>('/courses/categories');
export const courseDetail = (id: number) => get<CourseDetail>(`/courses/${id}`);
export const myCourses = () => get<MyCourse[]>('/courses/mine');

/* ------------------------- 管理端 ------------------------- */

export const adminCourses = (params: Record<string, any>) =>
  get<PageResult<Course & { sales: number }>>('/admin/courses', params);
export const adminCreateCourse = (data: Partial<Course>) => post('/admin/courses', data);
export const adminUpdateCourse = (id: number, data: Partial<Course>) =>
  put(`/admin/courses/${id}`, data);
export const adminDeleteCourse = (id: number) => del(`/admin/courses/${id}`);
export const adminChangeCourseStatus = (id: number, status: string) =>
  patch(`/admin/courses/${id}/status`, { status });

export const adminAddChapter = (courseId: number, data: { title: string; sort?: number }) =>
  post(`/admin/courses/${courseId}/chapters`, data);
export const adminUpdateChapter = (chapterId: number, data: { title: string; sort?: number }) =>
  put(`/admin/courses/chapters/${chapterId}`, data);
export const adminDeleteChapter = (chapterId: number) => del(`/admin/courses/chapters/${chapterId}`);

export const adminAddLesson = (
  courseId: number,
  chapterId: number,
  data: Partial<CourseLesson>,
) => post(`/admin/courses/${courseId}/chapters/${chapterId}/lessons`, data);
export const adminUpdateLesson = (lessonId: number, data: Partial<CourseLesson>) =>
  put(`/admin/courses/lessons/${lessonId}`, data);
export const adminDeleteLesson = (lessonId: number) => del(`/admin/courses/lessons/${lessonId}`);

export const adminCreateCategory = (data: { name: string; sort?: number }) =>
  post('/admin/courses/categories', data);
export const adminDeleteCategory = (id: number) => del(`/admin/courses/categories/${id}`);
