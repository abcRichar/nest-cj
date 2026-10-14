/**
 * 全局枚举与常量定义
 * 前后端共用，避免同一份「状态值」在两端各写一遍导致字段语义不一致。
 */

/** 用户角色 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

/** 账号状态 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

/** 课程难度 */
export enum CourseLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

/** 上下架状态 */
export enum PublishStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  OFFLINE = 'OFFLINE',
}

/** 订单状态 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

/** 支付方式 */
export enum PayType {
  ALIPAY = 'ALIPAY',
  BALANCE = 'BALANCE',
  FREE = 'FREE',
}

/** 单词掌握状态 */
export enum WordStatus {
  NEW = 'NEW',
  LEARNING = 'LEARNING',
  MASTERED = 'MASTERED',
}

/** 文件上传状态（用于断点续传 / 秒传） */
export enum FileStatus {
  UPLOADING = 'UPLOADING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** 系统统一响应码 */
export enum BizCode {
  SUCCESS = 0,
  FAIL = 1,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  PARAM_ERROR = 400,
}

/** Socket.IO 事件名（前后端必须一致） */
export const SOCKET_EVENTS = {
  /** 客户端 -> 服务端：加入房间 */
  JOIN_ROOM: 'join:room',
  /** 客户端 -> 服务端：离开房间 */
  LEAVE_ROOM: 'leave:room',
  /** 客户端 -> 服务端：心跳 */
  PING: 'client:ping',
  /** 服务端 -> 客户端：心跳响应 */
  PONG: 'server:pong',
  /** 服务端 -> 客户端：支付结果 */
  PAYMENT_RESULT: 'payment:result',
  /** 服务端 -> 客户端：订单状态变更 */
  ORDER_STATUS: 'order:status',
  /** 服务端 -> 客户端：新消息 */
  MESSAGE_NEW: 'message:new',
  /** 服务端 -> 客户端：未读数变化 */
  NOTICE_UNREAD: 'notice:unread',
  /** 服务端 -> 客户端：系统通知 */
  SYSTEM_NOTICE: 'system:notice',
  /** 服务端 -> 客户端：学习任务完成 */
  STUDY_TASK_DONE: 'study:task-done',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/** 分页默认值 */
export const PAGE_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

/** 业务常量 */
export const BIZ = {
  /** 阿里云/本地对象存储：大文件分片大小 5MB */
  CHUNK_SIZE: 5 * 1024 * 1024,
  /** 秒传阈值 */
  INSTANT_UPLOAD_MAX_SIZE: 100 * 1024 * 1024,
  /** 单词默认复习间隔（天）——艾宾浩斯 */
  WORD_REVIEW_INTERVALS: [1, 2, 4, 7, 15, 30, 60] as const,
  /** 每日学习日报发送时间（cron） */
  DAILY_REPORT_CRON: '0 0 21 * * *',
} as const;
