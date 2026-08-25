import { Injectable } from '@nestjs/common';
import type { RoomPeer } from '@airdrop/shared';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '@airdrop/shared';

type PeerRecord = {
  peerId: string;
  name: string;
  socketId: string;
};

type RoomRecord = {
  peers: Map<string, PeerRecord>;
  lastActiveAt: number;
};

const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, RoomRecord>();

  constructor() {
    setInterval(() => this.cleanupEmptyRooms(), 60_000).unref?.();
  }

  ensureRoom(roomId: string): string {
    const id = normalizeRoomCode(roomId);
    if (!this.rooms.has(id)) {
      this.rooms.set(id, { peers: new Map(), lastActiveAt: Date.now() });
    }
    return id;
  }

  createRoom(): string {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }
    this.rooms.set(code, { peers: new Map(), lastActiveAt: Date.now() });
    return code;
  }

  join(
    roomId: string,
    peer: { peerId: string; name: string; socketId: string },
  ): { roomId: string; peers: RoomPeer[] } | { error: string } {
    const id = normalizeRoomCode(roomId);
    if (!isValidRoomCode(id)) {
      return { error: 'Invalid room code' };
    }

    let room = this.rooms.get(id);
    if (!room) {
      room = { peers: new Map(), lastActiveAt: Date.now() };
      this.rooms.set(id, room);
    }

    // Replace stale same peerId if reconnecting
    room.peers.set(peer.peerId, {
      peerId: peer.peerId,
      name: peer.name.trim() || 'Guest',
      socketId: peer.socketId,
    });
    room.lastActiveAt = Date.now();

    return {
      roomId: id,
      peers: this.listPeers(id).filter((p) => p.peerId !== peer.peerId),
    };
  }

  leaveBySocket(socketId: string): { roomId: string; peerId: string } | null {
    for (const [roomId, room] of this.rooms) {
      for (const [peerId, peer] of room.peers) {
        if (peer.socketId === socketId) {
          room.peers.delete(peerId);
          room.lastActiveAt = Date.now();
          if (room.peers.size === 0) {
            // keep empty room briefly for rejoin via link
          }
          return { roomId, peerId };
        }
      }
    }
    return null;
  }

  leave(roomId: string, peerId: string): boolean {
    const room = this.rooms.get(normalizeRoomCode(roomId));
    if (!room) return false;
    const ok = room.peers.delete(peerId);
    room.lastActiveAt = Date.now();
    return ok;
  }

  getPeer(roomId: string, peerId: string): PeerRecord | undefined {
    return this.rooms.get(normalizeRoomCode(roomId))?.peers.get(peerId);
  }

  listPeers(roomId: string): RoomPeer[] {
    const room = this.rooms.get(normalizeRoomCode(roomId));
    if (!room) return [];
    return [...room.peers.values()].map(({ peerId, name }) => ({ peerId, name }));
  }

  findRoomByPeer(peerId: string): string | null {
    for (const [roomId, room] of this.rooms) {
      if (room.peers.has(peerId)) return roomId;
    }
    return null;
  }

  private cleanupEmptyRooms() {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (room.peers.size === 0 && now - room.lastActiveAt > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(roomId);
      }
    }
  }
}
