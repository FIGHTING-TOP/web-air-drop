import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  SIGNAL_EVENTS,
  type CreateRoomPayload,
  type JoinRoomPayload,
  type SignalPayload,
} from '@airdrop/shared';
import { RoomsService } from './rooms.service';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  },
})
export class SignalingGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly rooms: RoomsService) {}

  handleDisconnect(client: Socket) {
    const left = this.rooms.leaveBySocket(client.id);
    if (!left) return;
    client.to(left.roomId).emit(SIGNAL_EVENTS.PEER_LEFT, { peerId: left.peerId });
  }

  @SubscribeMessage(SIGNAL_EVENTS.ROOM_CREATE)
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CreateRoomPayload,
  ) {
    if (!body?.peerId || !body?.name) {
      return { error: 'peerId and name are required' };
    }
    const roomId = this.rooms.createRoom();
    const result = this.rooms.join(roomId, {
      peerId: body.peerId,
      name: body.name,
      socketId: client.id,
    });
    if ('error' in result) return result;
    void client.join(roomId);
    return result;
  }

  @SubscribeMessage(SIGNAL_EVENTS.ROOM_JOIN)
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomPayload,
  ) {
    if (!body?.roomId || !body?.peerId || !body?.name) {
      return { error: 'roomId, peerId and name are required' };
    }
    const result = this.rooms.join(body.roomId, {
      peerId: body.peerId,
      name: body.name,
      socketId: client.id,
    });
    if ('error' in result) return result;

    void client.join(result.roomId);
    client.to(result.roomId).emit(SIGNAL_EVENTS.PEER_JOINED, {
      peerId: body.peerId,
      name: body.name.trim() || 'Guest',
    });
    return result;
  }

  @SubscribeMessage(SIGNAL_EVENTS.ROOM_LEAVE)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; peerId: string },
  ) {
    if (!body?.roomId || !body?.peerId) return { ok: false };
    this.rooms.leave(body.roomId, body.peerId);
    void client.leave(body.roomId);
    client.to(body.roomId).emit(SIGNAL_EVENTS.PEER_LEFT, { peerId: body.peerId });
    return { ok: true };
  }

  @SubscribeMessage(SIGNAL_EVENTS.SIGNAL)
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SignalPayload,
  ) {
    if (!body?.to || !body?.from || !body?.data) return;
    const roomId = this.rooms.findRoomByPeer(body.from);
    if (!roomId) return;
    const target = this.rooms.getPeer(roomId, body.to);
    if (!target) return;
    this.server.to(target.socketId).emit(SIGNAL_EVENTS.SIGNAL, {
      to: body.to,
      from: body.from,
      data: body.data,
    } satisfies SignalPayload);
  }
}
