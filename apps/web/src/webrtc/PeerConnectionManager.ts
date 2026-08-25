import { CHUNK_SIZE, type DcControlMessage, type IceServerConfig, type SignalMessage } from '@airdrop/shared';
import { randomId } from '../lib/utils';

export type IncomingText = {
  transferId: string;
  text: string;
  fromPeerId: string;
  fromName: string;
  ts: number;
};

export type IncomingFile = {
  transferId: string;
  name: string;
  mime: string;
  size: number;
  fromPeerId: string;
  fromName: string;
  ts: number;
  blob: Blob;
  url: string;
};

export type TransferProgress = {
  transferId: string;
  peerId: string;
  direction: 'send' | 'receive';
  name: string;
  received: number;
  total: number;
  done: boolean;
};

type PeerSlot = {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  makingOffer: boolean;
  polite: boolean;
  ignoreOffer: boolean;
  pendingIce: RTCIceCandidateInit[];
};

type Handlers = {
  onPeerOpen?: (peerId: string) => void;
  onPeerClose?: (peerId: string) => void;
  onText?: (msg: IncomingText) => void;
  onFile?: (file: IncomingFile) => void;
  onProgress?: (p: TransferProgress) => void;
  onSignal: (to: string, data: SignalMessage) => void;
};

type PendingFile = {
  meta: Extract<DcControlMessage, { type: 'file-meta' }>;
  chunks: ArrayBuffer[];
  received: number;
};

function encodeTransferId(id: string): Uint8Array {
  const bytes = new Uint8Array(16);
  const encoded = new TextEncoder().encode(id.slice(0, 16));
  bytes.set(encoded);
  return bytes;
}

function decodeTransferId(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

function createId(): string {
  return randomId(16);
}

export class PeerConnectionManager {
  private readonly peers = new Map<string, PeerSlot>();
  private readonly pendingFiles = new Map<string, PendingFile>();
  /** Serialize signal handling per remote peer to avoid ICE racing ahead of SDP. */
  private readonly signalChains = new Map<string, Promise<void>>();
  private iceServers: IceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private localPeerId = '';
  private localName = '';
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  setIdentity(peerId: string, name: string) {
    this.localPeerId = peerId;
    this.localName = name;
  }

  setIceServers(servers: IceServerConfig[]) {
    if (servers.length > 0) this.iceServers = servers;
  }

  updateHandlers(partial: Partial<Handlers>) {
    this.handlers = { ...this.handlers, ...partial };
  }

  /** Existing peers: we are the offerer (impolite). New joiners will offer to us. */
  async connectToPeer(peerId: string, asOfferer: boolean) {
    if (this.peers.has(peerId) || peerId === this.localPeerId) return;
    const slot = this.createPeer(peerId, asOfferer);
    if (asOfferer) {
      slot.channel = slot.pc.createDataChannel('airdrop', { ordered: true });
      this.wireChannel(peerId, slot.channel);
      await this.makeOffer(peerId, slot);
    }
  }

  async handleSignal(from: string, data: SignalMessage) {
    const prev = this.signalChains.get(from) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.handleSignalQueued(from, data));
    this.signalChains.set(
      from,
      next.catch((err) => {
        console.error('handleSignal error', from, err);
      }),
    );
    await next;
  }

  private async handleSignalQueued(from: string, data: SignalMessage) {
    let slot = this.peers.get(from);

    // ICE before SDP: keep candidates, create PC only when SDP arrives.
    if (!slot && data.type === 'ice') {
      return;
    }
    if (!slot) {
      slot = this.createPeer(from, false);
    }

    if (data.type === 'offer') {
      const offerCollision = slot.makingOffer || slot.pc.signalingState !== 'stable';
      slot.ignoreOffer = !slot.polite && offerCollision;
      if (slot.ignoreOffer) return;
      await slot.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
      await this.flushPendingIce(slot);
      const answer = await slot.pc.createAnswer();
      await slot.pc.setLocalDescription(answer);
      this.handlers.onSignal(from, { type: 'answer', sdp: answer.sdp ?? '' });
      return;
    }

    if (data.type === 'answer') {
      if (slot.pc.signalingState === 'have-local-offer') {
        await slot.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await this.flushPendingIce(slot);
      }
      return;
    }

    if (data.type === 'ice') {
      const init = data.candidate
        ? {
            candidate: data.candidate.candidate ?? undefined,
            sdpMid: data.candidate.sdpMid ?? undefined,
            sdpMLineIndex: data.candidate.sdpMLineIndex ?? undefined,
            usernameFragment: data.candidate.usernameFragment ?? undefined,
          }
        : null;

      if (!slot.pc.remoteDescription) {
        if (init) slot.pendingIce.push(init);
        return;
      }
      try {
        await slot.pc.addIceCandidate(init);
      } catch (err) {
        if (!slot.ignoreOffer) throw err;
      }
    }
  }

  async sendText(peerIds: string[], text: string) {
    const transferId = createId();
    const msg: DcControlMessage = {
      type: 'text',
      transferId,
      text,
      fromPeerId: this.localPeerId,
      fromName: this.localName,
      ts: Date.now(),
    };
    const payload = JSON.stringify(msg);
    for (const peerId of peerIds) {
      this.sendRaw(peerId, payload);
    }
  }

  async sendFile(peerIds: string[], file: File) {
    const transferId = createId();
    const meta: DcControlMessage = {
      type: 'file-meta',
      transferId,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      fromPeerId: this.localPeerId,
      fromName: this.localName,
      ts: Date.now(),
    };

    for (const peerId of peerIds) {
      this.sendRaw(peerId, JSON.stringify(meta));
      this.handlers.onProgress?.({
        transferId,
        peerId,
        direction: 'send',
        name: file.name,
        received: 0,
        total: file.size,
        done: false,
      });

      let offset = 0;
      let index = 0;
      const channel = this.peers.get(peerId)?.channel;
      while (offset < file.size) {
        while (channel && channel.bufferedAmount > 512 * 1024) {
          await new Promise((r) => setTimeout(r, 20));
        }
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buf = await slice.arrayBuffer();
        this.sendBinaryChunk(peerId, transferId, index, buf);
        offset += buf.byteLength;
        index += 1;
        this.handlers.onProgress?.({
          transferId,
          peerId,
          direction: 'send',
          name: file.name,
          received: Math.min(offset, file.size),
          total: file.size,
          done: offset >= file.size,
        });
      }

      this.sendRaw(peerId, JSON.stringify({ type: 'file-done', transferId } satisfies DcControlMessage));
    }
  }

  removePeer(peerId: string) {
    const slot = this.peers.get(peerId);
    if (!slot) return;
    try {
      slot.channel?.close();
      slot.pc.close();
    } catch {
      /* ignore */
    }
    this.peers.delete(peerId);
    this.signalChains.delete(peerId);
    this.handlers.onPeerClose?.(peerId);
  }

  destroy() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
  }

  getConnectedPeerIds(): string[] {
    return [...this.peers.entries()]
      .filter(([, s]) => s.channel?.readyState === 'open')
      .map(([id]) => id);
  }

  private async flushPendingIce(slot: PeerSlot) {
    const queued = slot.pendingIce.splice(0, slot.pendingIce.length);
    for (const init of queued) {
      try {
        await slot.pc.addIceCandidate(init);
      } catch (err) {
        if (!slot.ignoreOffer) console.warn('flush ice failed', err);
      }
    }
  }

  private createPeer(peerId: string, asOfferer: boolean): PeerSlot {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const slot: PeerSlot = {
      pc,
      channel: null,
      makingOffer: false,
      polite: !asOfferer,
      ignoreOffer: false,
      pendingIce: [],
    };
    this.peers.set(peerId, slot);

    pc.onicecandidate = (ev) => {
      this.handlers.onSignal(peerId, {
        type: 'ice',
        candidate: ev.candidate
          ? {
              candidate: ev.candidate.candidate,
              sdpMid: ev.candidate.sdpMid,
              sdpMLineIndex: ev.candidate.sdpMLineIndex,
              usernameFragment: ev.candidate.usernameFragment,
            }
          : null,
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    pc.ondatachannel = (ev) => {
      slot.channel = ev.channel;
      this.wireChannel(peerId, ev.channel);
    };

    return slot;
  }

  private async makeOffer(peerId: string, slot: PeerSlot) {
    try {
      slot.makingOffer = true;
      const offer = await slot.pc.createOffer();
      await slot.pc.setLocalDescription(offer);
      this.handlers.onSignal(peerId, { type: 'offer', sdp: offer.sdp ?? '' });
    } finally {
      slot.makingOffer = false;
    }
  }

  private wireChannel(peerId: string, channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => this.handlers.onPeerOpen?.(peerId);
    channel.onclose = () => this.handlers.onPeerClose?.(peerId);
    channel.onmessage = (ev) => this.onMessage(peerId, ev.data);
  }

  private sendRaw(peerId: string, data: string | Uint8Array) {
    const channel = this.peers.get(peerId)?.channel;
    if (!channel || channel.readyState !== 'open') {
      console.warn('channel not open for', peerId);
      return;
    }
    if (typeof data === 'string') {
      channel.send(data);
    } else {
      channel.send(data as unknown as ArrayBufferView<ArrayBuffer>);
    }
  }

  private sendBinaryChunk(peerId: string, transferId: string, index: number, payload: ArrayBuffer) {
    const header = new Uint8Array(1 + 16 + 4);
    header[0] = 1;
    header.set(encodeTransferId(transferId), 1);
    const view = new DataView(header.buffer);
    view.setUint32(17, index);
    const out = new Uint8Array(header.byteLength + payload.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(payload), header.byteLength);
    this.sendRaw(peerId, out);
  }

  private onMessage(peerId: string, data: unknown) {
    if (typeof data === 'string') {
      this.onControl(peerId, JSON.parse(data) as DcControlMessage);
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.onBinary(peerId, data);
    }
  }

  private onControl(peerId: string, msg: DcControlMessage) {
    if (msg.type === 'text') {
      this.handlers.onText?.(msg);
      return;
    }
    if (msg.type === 'file-meta') {
      this.pendingFiles.set(msg.transferId, {
        meta: msg,
        chunks: [],
        received: 0,
      });
      this.handlers.onProgress?.({
        transferId: msg.transferId,
        peerId,
        direction: 'receive',
        name: msg.name,
        received: 0,
        total: msg.size,
        done: false,
      });
      return;
    }
    if (msg.type === 'file-done') {
      const pending = this.pendingFiles.get(msg.transferId);
      if (!pending) return;
      const blob = new Blob(pending.chunks, { type: pending.meta.mime });
      const url = URL.createObjectURL(blob);
      this.handlers.onFile?.({
        transferId: pending.meta.transferId,
        name: pending.meta.name,
        mime: pending.meta.mime,
        size: pending.meta.size,
        fromPeerId: pending.meta.fromPeerId,
        fromName: pending.meta.fromName,
        ts: pending.meta.ts,
        blob,
        url,
      });
      this.handlers.onProgress?.({
        transferId: msg.transferId,
        peerId,
        direction: 'receive',
        name: pending.meta.name,
        received: pending.meta.size,
        total: pending.meta.size,
        done: true,
      });
      this.sendRaw(
        peerId,
        JSON.stringify({ type: 'file-ack', transferId: msg.transferId } satisfies DcControlMessage),
      );
      this.pendingFiles.delete(msg.transferId);
    }
  }

  private onBinary(_peerId: string, buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] !== 1 || bytes.byteLength < 21) return;
    const transferId = decodeTransferId(bytes.subarray(1, 17));
    const payload = bytes.subarray(21);
    const pending = this.pendingFiles.get(transferId);
    if (!pending) return;
    const copy = payload.slice().buffer;
    pending.chunks.push(copy);
    pending.received += payload.byteLength;
    this.handlers.onProgress?.({
      transferId,
      peerId: _peerId,
      direction: 'receive',
      name: pending.meta.name,
      received: pending.received,
      total: pending.meta.size,
      done: false,
    });
  }
}
