import { Body, Controller, Post } from '@nestjs/common';
import { generateRoomCode } from '@airdrop/shared';
import { RoomsService } from './rooms.service';

@Controller('api/rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  create(@Body() body?: { roomId?: string }) {
    const roomId = body?.roomId?.trim()
      ? body.roomId.trim().toUpperCase()
      : generateRoomCode();
    this.rooms.ensureRoom(roomId);
    return { roomId };
  }
}
