import { io, type Socket } from 'socket.io-client';
import { ElNotification } from 'element-plus';
import { SOCKET_EVENTS, type OrderStatus } from '@elp/shared';
import { useUserStore } from '@/stores/user';

/**
 * WebSocket 单例封装
 * 连接、鉴权、断线重连、业务事件分发都在这里统一处理
 */
let socket: Socket | null = null;

export interface PaymentResultPayload {
  orderNo: string;
  courseId: number;
  amount: number;
  status: OrderStatus;
  message: string;
  paidAt?: string;
}

type Listener<T = any> = (payload: T) => void;

export function useSocket() {
  const userStore = useUserStore();

  function connect(token?: string) {
    const t = token ?? userStore.token;
    if (!t) return;
    if (socket?.connected) return;

    socket = io('/ws', {
      transports: ['websocket', 'polling'],
      auth: { token: t },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      timeout: 8000,
    });

    socket.on('connect', () => {
      console.info('[ws] connected', socket?.id);
    });

    socket.on('connected', (payload) => {
      console.info('[ws] authed as user', payload?.userId);
    });

    socket.on('error', (err: any) => {
      console.warn('[ws] error', err?.message ?? err);
    });

    socket.on('disconnect', (reason) => {
      console.info('[ws] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ws] connect_error:', err.message);
    });

    // 系统公告
    socket.on(SOCKET_EVENTS.SYSTEM_NOTICE, (payload: any) => {
      ElNotification({
        title: '系统公告',
        message: payload?.title ?? '',
        type: 'info',
        duration: 5000,
      });
    });

    // 学习任务提醒
    socket.on(SOCKET_EVENTS.STUDY_TASK_DONE, (payload: any) => {
      ElNotification({
        title: '学习提醒',
        message: payload?.message ?? '有新任务待完成',
        type: 'success',
        duration: 4000,
      });
    });
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
  }

  /** 订阅业务事件，返回取消订阅函数 */
  function on<T = any>(event: string, handler: Listener<T>) {
    socket?.on(event, handler);
    return () => socket?.off(event, handler);
  }

  function off(event: string, handler?: Listener) {
    if (handler) socket?.off(event, handler);
    else socket?.off(event);
  }

  function get() {
    return socket;
  }

  return { connect, disconnect, on, off, get, get connected() { return socket?.connected ?? false; } };
}
