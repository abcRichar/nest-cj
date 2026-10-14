import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, type JwtPayload } from '@elp/shared';

interface AuthedSocket extends Socket {
  user?: JwtPayload;
}

/**
 * 实时通信网关
 * 房间约定：
 *   user:{userId}   -> 用户私有消息（支付结果、学习提醒）
 *   admin           -> 管理端广播（新订单、系统通知）
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log(`Socket.IO 网关已启动，命名空间: /ws`);
  }

  async handleConnection(client: AuthedSocket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      this.logger.warn(`客户端 ${client.id} 未携带 token，连接被拒绝`);
      client.emit('error', { message: '未提供登录凭证' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      client.user = payload;
      await client.join(`user:${payload.sub}`);
      if (payload.role === 'ADMIN') await client.join('admin');
      client.emit('connected', { userId: payload.sub, scope: payload.scope, sid: client.id });
      this.logger.log(`用户 ${payload.sub}(${payload.username}) 已连接 sid=${client.id}`);
    } catch {
      this.logger.warn(`客户端 ${client.id} token 校验失败`);
      client.emit('error', { message: '登录凭证无效' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.log(`客户端断开 sid=${client.id} userId=${client.user?.sub ?? '-'}`);
  }

  /* ------------------------- 客户端主动消息 ------------------------- */

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  async handleJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { room: string }) {
    // 只允许加入自己的私有房间，防止越权订阅
    const allowed = [`user:${client.user?.sub}`];
    if (allowed.includes(body?.room)) {
      await client.join(body.room);
      return { ok: true, room: body.room };
    }
    return { ok: false, message: '无权加入该房间' };
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_ROOM)
  async handleLeave(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { room: string }) {
    await client.leave(body.room);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.PING)
  handlePing(@MessageBody() body: unknown) {
    return { event: SOCKET_EVENTS.PONG, data: { ts: Date.now(), echo: body } };
  }

  /* ------------------------- 服务端推送 ------------------------- */

  /** 支付结果推送给指定用户（支付闭环的关键一环） */
  pushPaymentResult(userId: number, payload: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit(SOCKET_EVENTS.PAYMENT_RESULT, payload);
    this.server?.to('admin').emit(SOCKET_EVENTS.ORDER_STATUS, payload);
    this.logger.log(`支付结果已推送 user=${userId} orderNo=${payload.orderNo}`);
  }

  pushOrderStatus(userId: number, payload: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit(SOCKET_EVENTS.ORDER_STATUS, payload);
  }

  pushMessage(userId: number, payload: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
  }

  pushSystemNotice(payload: Record<string, unknown>) {
    this.server?.emit(SOCKET_EVENTS.SYSTEM_NOTICE, payload);
  }

  pushStudyTaskDone(userId: number, payload: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit(SOCKET_EVENTS.STUDY_TASK_DONE, payload);
  }

  /** 在线连接数（管理端看板） */
  onlineCount(): number {
    const s = this.server as any;
    return s?.sockets?.sockets?.size ?? s?.engine?.clientsCount ?? 0;
  }
}
