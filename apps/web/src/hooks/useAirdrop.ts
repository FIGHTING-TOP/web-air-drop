import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SIGNAL_EVENTS,
  type CreateRoomResult,
  type IceConfigResponse,
  type JoinRoomResult,
  type RoomPeer,
  type SignalPayload,
} from '@airdrop/shared';
import { randomId } from '../lib/utils';
import {
  PeerConnectionManager,
  type IncomingFile,
  type IncomingText,
  type TransferProgress,
} from '../webrtc/PeerConnectionManager';

export type { TransferProgress, IncomingFile, IncomingText };

export type ChatItem =
  | { kind: 'text'; id: string; fromName: string; fromPeerId: string; text: string; ts: number; mine: boolean }
  | {
      kind: 'file';
      id: string;
      fromName: string;
      fromPeerId: string;
      name: string;
      mime: string;
      size: number;
      url: string;
      ts: number;
      mine: boolean;
    };

type RoomState = {
  roomId: string;
  peerId: string;
  name: string;
};

export function useAirdrop() {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [readyPeers, setReadyPeers] = useState<string[]>([]);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [progress, setProgress] = useState<TransferProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcmRef = useRef<PeerConnectionManager | null>(null);
  const roomRef = useRef<RoomState | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'], autoConnect: true });
    socketRef.current = socket;

    const pcm = new PeerConnectionManager({
      onSignal: (to, data) => {
        const me = roomRef.current;
        if (!me) return;
        const payload: SignalPayload = { to, from: me.peerId, data };
        socket.emit(SIGNAL_EVENTS.SIGNAL, payload);
      },
      onPeerOpen: (peerId) => {
        setReadyPeers((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
      },
      onPeerClose: (peerId) => {
        setReadyPeers((prev) => prev.filter((id) => id !== peerId));
      },
      onText: (msg: IncomingText) => {
        setItems((prev) => [
          ...prev,
          {
            kind: 'text',
            id: msg.transferId,
            fromName: msg.fromName,
            fromPeerId: msg.fromPeerId,
            text: msg.text,
            ts: msg.ts,
            mine: false,
          },
        ]);
      },
      onFile: (file: IncomingFile) => {
        setItems((prev) => [
          ...prev,
          {
            kind: 'file',
            id: file.transferId,
            fromName: file.fromName,
            fromPeerId: file.fromPeerId,
            name: file.name,
            mime: file.mime,
            size: file.size,
            url: file.url,
            ts: file.ts,
            mine: false,
          },
        ]);
      },
      onProgress: (p) => {
        setProgress((prev) => {
          const rest = prev.filter((x) => !(x.transferId === p.transferId && x.peerId === p.peerId && x.direction === p.direction));
          if (p.done) return rest;
          return [...rest, p];
        });
      },
    });
    pcmRef.current = pcm;

    void fetch('/api/ice')
      .then((r) => r.json() as Promise<IceConfigResponse>)
      .then((cfg) => pcm.setIceServers(cfg.iceServers))
      .catch(() => {
        /* keep default STUN */
      });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on(SIGNAL_EVENTS.PEER_JOINED, (peer: RoomPeer) => {
      setPeers((prev) => (prev.some((p) => p.peerId === peer.peerId) ? prev : [...prev, peer]));
      // New peer joins → they will offer to us; we wait for their offer.
      // Also ensure we have a slot ready as polite peer when signal arrives.
    });

    socket.on(SIGNAL_EVENTS.PEER_LEFT, ({ peerId }: { peerId: string }) => {
      setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
      pcm.removePeer(peerId);
    });

    socket.on(SIGNAL_EVENTS.SIGNAL, (payload: SignalPayload) => {
      void pcm.handleSignal(payload.from, payload.data);
    });

    return () => {
      socket.disconnect();
      pcm.destroy();
      socketRef.current = null;
      pcmRef.current = null;
    };
  }, []);

  const createRoom = useCallback(async (peerId: string, name: string) => {
    setError(null);
    const socket = socketRef.current;
    const pcm = pcmRef.current;
    if (!socket || !pcm) return;

    pcm.setIdentity(peerId, name);
    const result = (await socket.emitWithAck(SIGNAL_EVENTS.ROOM_CREATE, {
      peerId,
      name,
    })) as CreateRoomResult | { error: string };

    if ('error' in result) {
      setError(result.error);
      return;
    }

    // Must sync roomRef before any WebRTC signaling (setState is async).
    const next = { roomId: result.roomId, peerId, name };
    roomRef.current = next;
    setRoom(next);
    setPeers(result.peers);
    const url = new URL(window.location.href);
    url.searchParams.set('room', result.roomId);
    window.history.replaceState({}, '', url);
  }, []);

  const joinRoom = useCallback(async (roomId: string, peerId: string, name: string) => {
    setError(null);
    const socket = socketRef.current;
    const pcm = pcmRef.current;
    if (!socket || !pcm) return;

    pcm.setIdentity(peerId, name);
    const result = (await socket.emitWithAck(SIGNAL_EVENTS.ROOM_JOIN, {
      roomId,
      peerId,
      name,
    })) as JoinRoomResult | { error: string };

    if ('error' in result) {
      setError(result.error);
      return;
    }

    // Sync before connectToPeer — otherwise offer/ICE are dropped (onSignal checks roomRef).
    const next = { roomId: result.roomId, peerId, name };
    roomRef.current = next;
    setRoom(next);
    setPeers(result.peers);
    const url = new URL(window.location.href);
    url.searchParams.set('room', result.roomId);
    window.history.replaceState({}, '', url);

    // Joiner offers to every existing peer (mesh)
    for (const peer of result.peers) {
      await pcm.connectToPeer(peer.peerId, true);
    }
  }, []);

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    const pcm = pcmRef.current;
    const me = roomRef.current;
    if (socket && me) {
      socket.emit(SIGNAL_EVENTS.ROOM_LEAVE, { roomId: me.roomId, peerId: me.peerId });
    }
    if (pcm) {
      for (const p of peers) pcm.removePeer(p.peerId);
    }
    roomRef.current = null;
    setRoom(null);
    setPeers([]);
    setReadyPeers([]);
    setItems([]);
    setProgress([]);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);
  }, [peers]);

  const sendText = useCallback(
    async (text: string, targetPeerIds: string[] | 'all') => {
      const pcm = pcmRef.current;
      const me = roomRef.current;
      if (!pcm || !me || !text.trim()) return;
      const targets = targetPeerIds === 'all' ? readyPeers : targetPeerIds.filter((id) => readyPeers.includes(id));
      if (targets.length === 0) {
        setError('没有已连接的设备');
        return;
      }
      await pcm.sendText(targets, text.trim());
      setItems((prev) => [
        ...prev,
        {
          kind: 'text',
          id: randomId(),
          fromName: me.name,
          fromPeerId: me.peerId,
          text: text.trim(),
          ts: Date.now(),
          mine: true,
        },
      ]);
    },
    [readyPeers],
  );

  const sendFiles = useCallback(
    async (files: FileList | File[], targetPeerIds: string[] | 'all') => {
      const pcm = pcmRef.current;
      const me = roomRef.current;
      if (!pcm || !me) return;
      const targets = targetPeerIds === 'all' ? readyPeers : targetPeerIds.filter((id) => readyPeers.includes(id));
      if (targets.length === 0) {
        setError('没有已连接的设备');
        return;
      }
      for (const file of Array.from(files)) {
        await pcm.sendFile(targets, file);
        const url = URL.createObjectURL(file);
        setItems((prev) => [
          ...prev,
          {
            kind: 'file',
            id: randomId(),
            fromName: me.name,
            fromPeerId: me.peerId,
            name: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            url,
            ts: Date.now(),
            mine: true,
          },
        ]);
      }
    },
    [readyPeers],
  );

  return {
    connected,
    room,
    peers,
    readyPeers,
    items,
    progress,
    error,
    setError,
    createRoom,
    joinRoom,
    leaveRoom,
    sendText,
    sendFiles,
  };
}
