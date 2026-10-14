import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user';

const routes: RouteRecordRaw[] = [
  /* ---------------------------- 用户端 ---------------------------- */
  {
    path: '/',
    component: () => import('@/layouts/UserLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/Home.vue'), meta: { title: '首页' } },
      {
        path: 'courses',
        name: 'courses',
        component: () => import('@/views/course/CourseList.vue'),
        meta: { title: '课程中心', public: true },
      },
      {
        path: 'courses/:id',
        name: 'course-detail',
        component: () => import('@/views/course/CourseDetail.vue'),
        meta: { title: '课程详情', public: true },
      },
      {
        path: 'study/:courseId',
        name: 'course-player',
        component: () => import('@/views/course/CoursePlayer.vue'),
        meta: { title: '开始学习', auth: true },
      },
      {
        path: 'words',
        name: 'words',
        component: () => import('@/views/word/WordBook.vue'),
        meta: { title: '单词本', auth: true },
      },
      {
        path: 'words/review',
        name: 'word-review',
        component: () => import('@/views/word/WordReview.vue'),
        meta: { title: '单词复习', auth: true },
      },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('@/views/chat/ChatView.vue'),
        meta: { title: 'AI 对话', auth: true },
      },
      {
        path: 'me',
        component: () => import('@/components/MeNav.vue'),
        meta: { auth: true },
        children: [
          {
            path: '',
            name: 'me',
            component: () => import('@/views/user/Profile.vue'),
            meta: { title: '个人中心', auth: true },
          },
          {
            path: 'courses',
            name: 'my-courses',
            component: () => import('@/views/user/MyCourses.vue'),
            meta: { title: '我的课程', auth: true },
          },
          {
            path: 'orders',
            name: 'my-orders',
            component: () => import('@/views/user/MyOrders.vue'),
            meta: { title: '我的订单', auth: true },
          },
          {
            path: 'reports',
            name: 'my-reports',
            component: () => import('@/views/user/MyReports.vue'),
            meta: { title: '学习日报', auth: true },
          },
        ],
      },
      {
        path: 'payment/result',
        name: 'pay-result',
        component: () => import('@/views/payment/PayResult.vue'),
        meta: { title: '支付结果', auth: true },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', guest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册', guest: true },
  },

  /* ---------------------------- 管理端 ---------------------------- */
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/Login.vue'),
    meta: { title: '管理端登录', guest: true, admin: true },
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { admin: true, adminAuth: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据看板', adminAuth: true },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/views/admin/Users.vue'),
        meta: { title: '用户管理', adminAuth: true },
      },
      {
        path: 'courses',
        name: 'admin-courses',
        component: () => import('@/views/admin/Courses.vue'),
        meta: { title: '课程管理', adminAuth: true },
      },
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/views/admin/Orders.vue'),
        meta: { title: '订单管理', adminAuth: true },
      },
      {
        path: 'ai-roles',
        name: 'admin-ai-roles',
        component: () => import('@/views/admin/AiRoles.vue'),
        meta: { title: 'AI 角色', adminAuth: true },
      },
      {
        path: 'files',
        name: 'admin-files',
        component: () => import('@/views/admin/Files.vue'),
        meta: { title: '文件存储', adminAuth: true },
      },
      {
        path: 'notices',
        name: 'admin-notices',
        component: () => import('@/views/admin/Notices.vue'),
        meta: { title: '公告管理', adminAuth: true },
      },
      {
        path: 'reports',
        name: 'admin-reports',
        component: () => import('@/views/admin/Reports.vue'),
        meta: { title: '学习日报', adminAuth: true },
      },
    ],
  },

  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const store = useUserStore();
  store.restore();

  document.title = to.meta.title
    ? `${to.meta.title} · ${import.meta.env.VITE_APP_TITLE || 'LinguaFlow'}`
    : import.meta.env.VITE_APP_TITLE || 'LinguaFlow';

  // 管理端鉴权
  if (to.meta.adminAuth && !store.adminToken) {
    return { path: '/admin/login', query: { redirect: to.fullPath } };
  }
  // 用户端鉴权
  if (to.meta.auth && !store.userToken) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  // 已登录访问登录页
  if (to.meta.guest) {
    if (to.meta.admin && store.adminToken) return { path: '/admin/dashboard' };
    if (!to.meta.admin && store.userToken) return { path: '/' };
  }
  return true;
});

export default router;
