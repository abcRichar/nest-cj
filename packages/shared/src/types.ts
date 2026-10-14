import type {
  CourseLevel,
  FileStatus,
  OrderStatus,
  PayType,
  PublishStatus,
  UserRole,
  UserStatus,
  WordStatus,
} from './constants';

/** 统一响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

/** 分页请求 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

/** 分页响应 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ------------------------------------------------------------------ */
/* 用户                                                                */
/* ------------------------------------------------------------------ */

export interface User {
  id: number;
  username: string;
  nickname: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: UserRole;
  status: UserStatus;
  bio?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

export interface LoginDto {
  account: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  captcha?: string;
}

export interface LoginVo {
  token: string;
  expiresIn: number;
  user: User;
}

/** JWT 载荷 */
export interface JwtPayload {
  sub: number;
  username: string;
  role: UserRole;
  /** 区分用户端 / 管理端签发 */
  scope: 'user' | 'admin';
  iat?: number;
  exp?: number;
}

/* ------------------------------------------------------------------ */
/* 课程                                                                */
/* ------------------------------------------------------------------ */

export interface Course {
  id: number;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  level: CourseLevel;
  categoryId?: number | null;
  categoryName?: string | null;
  teacher: string;
  duration: number;
  lessonCount: number;
  studentCount: number;
  rating: number;
  tags?: string[] | null;
  status: PublishStatus;
  sort: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CourseChapter {
  id: number;
  courseId: number;
  title: string;
  sort: number;
  lessons?: CourseLesson[];
}

export interface CourseLesson {
  id: number;
  chapterId: number;
  courseId: number;
  title: string;
  videoUrl?: string | null;
  duration: number;
  isFree: boolean;
  sort: number;
  /** 当前用户学习进度（0-100） */
  progress?: number;
}

export interface CourseCategory {
  id: number;
  name: string;
  sort: number;
  courseCount?: number;
}

/** 我的课程（含学习进度） */
export interface MyCourse {
  courseId: number;
  course: Course;
  progress: number;
  lastLessonId?: number | null;
  lastStudyAt?: string | null;
  expireAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* 单词                                                                */
/* ------------------------------------------------------------------ */

export interface WordBook {
  id: number;
  userId: number;
  name: string;
  description?: string | null;
  isDefault: boolean;
  total: number;
  mastered: number;
  createdAt: string;
}

export interface Word {
  id: number;
  bookId: number;
  userId: number;
  word: string;
  phonetic?: string | null;
  translation: string;
  example?: string | null;
  exampleZh?: string | null;
  audioUrl?: string | null;
  tags?: string[] | null;
  status: WordStatus;
  reviewCount: number;
  correctCount: number;
  nextReviewAt?: string | null;
  createdAt: string;
}

export interface WordCreateDto {
  bookId: number;
  word: string;
  phonetic?: string;
  translation: string;
  example?: string;
  exampleZh?: string;
  tags?: string[];
}

export interface WordReviewDto {
  wordId: number;
  /** 本次是否答对 */
  correct: boolean;
  /** 真实作答耗时（毫秒） */
  cost?: number;
}

export interface WordReviewResult {
  wordId: number;
  status: WordStatus;
  reviewCount: number;
  nextReviewAt: string;
  /** 下次复习间隔天数 */
  intervalDays: number;
}

/* ------------------------------------------------------------------ */
/* 学习进度                                                            */
/* ------------------------------------------------------------------ */

export interface StudyRecord {
  id: number;
  userId: number;
  courseId: number;
  lessonId: number;
  duration: number;
  progress: number;
  createdAt: string;
}

export interface StudyOverview {
  /** 累计学习天数 */
  studyDays: number;
  /** 今日学习时长（秒） */
  todayDuration: number;
  /** 累计学习时长（秒） */
  totalDuration: number;
  /** 已购课程数 */
  courseCount: number;
  /** 已掌握单词数 */
  masteredWords: number;
  /** 最近 7 天每日学习时长 */
  weekTrend: Array<{ date: string; duration: number }>;
}

/* ------------------------------------------------------------------ */
/* 订单与支付                                                          */
/* ------------------------------------------------------------------ */

export interface Order {
  id: number;
  orderNo: string;
  userId: number;
  courseId: number;
  courseTitle?: string;
  courseCover?: string | null;
  amount: number;
  status: OrderStatus;
  payType: PayType;
  alipayTradeNo?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface CreateOrderDto {
  courseId: number;
  payType?: PayType;
}

export interface AlipayPayVo {
  orderNo: string;
  /** 支付宝返回的支付表单 HTML（PC 网页支付） */
  payForm: string;
  /** 二维码链接（当面付） */
  qrCode?: string;
}

/* ------------------------------------------------------------------ */
/* AI 对话                                                             */
/* ------------------------------------------------------------------ */

export interface AiRole {
  id: number;
  code: string;
  name: string;
  avatar?: string | null;
  description?: string | null;
  systemPrompt: string;
  greeting: string;
  category: string;
  /** 是否开启联网搜索 */
  enableSearch: boolean;
  enabled: boolean;
  sort: number;
}

export interface Conversation {
  id: number;
  userId: number;
  roleId: number;
  roleName?: string;
  roleAvatar?: string | null;
  title: string;
  lastMessage?: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: ChatRole;
  content: string;
  /** 工具调用轨迹（ReAct 过程） */
  toolCalls?: ToolCallTrace[] | null;
  tokens?: number | null;
  createdAt: string;
}

export interface ToolCallTrace {
  name: string;
  input?: string;
  output?: string;
  status: 'running' | 'success' | 'error';
  costMs?: number;
}

export interface CreateConversationDto {
  roleId: number;
  title?: string;
}

export interface SendMessageDto {
  conversationId: number;
  content: string;
  /** 是否临时开启联网搜索 */
  enableSearch?: boolean;
}

/** SSE 流式事件类型 */
export type StreamEventType =
  | 'start'
  | 'delta'
  | 'tool'
  | 'usage'
  | 'done'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  /** 会话 id */
  conversationId?: number;
  /** 当前流事件 id，用于前端去重 */
  messageId?: number;
  /** 增量文本 */
  content?: string;
  /** 工具轨迹 */
  tool?: ToolCallTrace;
  /** token 用量 */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

/* ------------------------------------------------------------------ */
/* 文件存储                                                            */
/* ------------------------------------------------------------------ */

export interface FileObject {
  id: number;
  userId: number;
  bucket: string;
  objectKey: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  /** 文件内容 md5，用于秒传 */
  hash: string;
  status: FileStatus;
  createdAt: string;
}

/** 秒传/上传初始化请求 */
export interface UploadInitDto {
  name: string;
  size: number;
  mimeType: string;
  /** 文件 md5（整文件或分片校验值） */
  hash: string;
  /** 总分片数 */
  totalChunks?: number;
}

/** 秒传/上传初始化响应 */
export interface UploadInitVo {
  /** 是否命中秒传 */
  instant: boolean;
  fileId?: number;
  url?: string;
  /** 未命中时需要上传的分片序号 */
  uploadedChunks?: number[];
  /** 分片大小 */
  chunkSize?: number;
}

/* ------------------------------------------------------------------ */
/* 管理端看板                                                          */
/* ------------------------------------------------------------------ */

export interface DashboardStat {
  userTotal: number;
  userTodayNew: number;
  orderTotal: number;
  orderTodayCount: number;
  revenueTotal: number;
  revenueToday: number;
  courseTotal: number;
  activeUser7d: number;
  trend: Array<{ date: string; revenue: number; orders: number; newUsers: number }>;
  hotCourses: Array<{ courseId: number; title: string; sales: number }>;
}

/* ------------------------------------------------------------------ */
/* 学习日报                                                            */
/* ------------------------------------------------------------------ */

export interface DailyReport {
  id: number;
  userId: number;
  reportDate: string;
  /** AI 生成的正文（markdown） */
  content: string;
  /** 结构化的统计快照 */
  stats?: Record<string, unknown> | null;
  emailed: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 通知公告                                                            */
/* ------------------------------------------------------------------ */

export interface Notice {
  id: number;
  title: string;
  content: string;
  type: 'SYSTEM' | 'ACTIVITY' | 'COURSE';
  published: boolean;
  createdAt: string;
}
