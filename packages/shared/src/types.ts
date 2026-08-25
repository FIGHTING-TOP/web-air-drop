export const SIGNAL_EVENTS = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_PEERS: 'room:peers',
  PEER_JOINED: 'peer:joined',
  PEER_LEFT: 'peer:left',
  SIGNAL: 'signal',
  ERROR: 'error',
} as const;

export type SignalEvent = (typeof SIGNAL_EVENTS)[keyof typeof SIGNAL_EVENTS];

export type RoomPeer = {
  peerId: string;
  name: string;
};

export type CreateRoomPayload = {
  peerId: string;
  name: string;
};

export type CreateRoomResult = {
  roomId: string;
  peers: RoomPeer[];
};

export type JoinRoomPayload = {
  roomId: string;
  peerId: string;
  name: string;
};

export type JoinRoomResult = {
  roomId: string;
  peers: RoomPeer[];
};

export type SignalPayload = {
  to: string;
  from: string;
  data: SignalMessage;
};

export type IceCandidateInit = {
  candidate?: string | null;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type SignalMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidateInit | null };

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type IceConfigResponse = {
  iceServers: IceServerConfig[];
};

/** DataChannel JSON control messages (UTF-8 text frames). */
export type DcControlMessage =
  | {
      type: 'text';
      transferId: string;
      text: string;
      fromPeerId: string;
      fromName: string;
      ts: number;
    }
  | {
      type: 'file-meta';
      transferId: string;
      name: string;
      mime: string;
      size: number;
      fromPeerId: string;
      fromName: string;
      ts: number;
    }
  | {
      type: 'file-done';
      transferId: string;
    }
  | {
      type: 'file-ack';
      transferId: string;
    }
  | {
      type: 'progress';
      transferId: string;
      received: number;
      total: number;
    };

export const CHUNK_SIZE = 16 * 1024;

/** Binary chunk framing: [1 byte type=1][16 bytes transferId utf8 padded][4 byte index BE][payload] */
export const BINARY_CHUNK_TYPE = 1;

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const CLIPBOARD_ID_LENGTH = 8;

export type ClipboardFileMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  storedName: string;
};

export type ClipboardPayload = {
  id: string;
  text: string;
  files: ClipboardFileMeta[];
  updatedAt: number;
};
