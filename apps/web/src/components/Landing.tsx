import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { normalizeRoomCode } from '@airdrop/shared';
import { createPeerId } from '../lib/utils';

type Props = {
  initialRoomId?: string;
  onCreate: (peerId: string, name: string) => Promise<void>;
  onJoin: (roomId: string, peerId: string, name: string) => Promise<void>;
  error: string | null;
  connected: boolean;
};

const NAME_KEY = 'airdrop-name';

export function Landing({ initialRoomId, onCreate, onJoin, error, connected }: Props) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [roomCode, setRoomCode] = useState(initialRoomId ?? '');
  const [busy, setBusy] = useState(false);
  const peerId = useMemo(() => createPeerId(), []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem(NAME_KEY, name.trim());
    setBusy(true);
    try {
      await onCreate(peerId, name.trim());
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !roomCode.trim()) return;
    localStorage.setItem(NAME_KEY, name.trim());
    setBusy(true);
    try {
      await onJoin(normalizeRoomCode(roomCode), peerId, name.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <header className="landing__brand">
        <p className="landing__eyebrow">P2P · WebRTC</p>
        <h1 className="landing__title">Web AirDrop</h1>
        <p className="landing__sub">在设备之间直传文本、图片与音视频。文件不经服务器中转。</p>
      </header>

      <p className="panel" style={{ margin: 0 }}>
        <Link to="/clipboard" className="link">
          打开网络剪切板 →
        </Link>
        <span className="muted small" style={{ display: 'block', marginTop: '0.35rem' }}>
          通过共享 ID 在服务端暂存文本与文件
        </span>
      </p>

      <form className="panel" onSubmit={handleCreate}>
        <label className="field">
          <span>你的昵称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：MacBook / iPhone"
            maxLength={32}
            required
            autoFocus
          />
        </label>

        <div className="actions">
          <button type="submit" disabled={!connected || busy || !name.trim()}>
            创建房间
          </button>
        </div>
      </form>

      <form className="panel" onSubmit={handleJoin}>
        <label className="field">
          <span>房间码</span>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="6 位房间码"
            maxLength={8}
            spellCheck={false}
            className="mono"
          />
        </label>
        <div className="actions">
          <button type="submit" className="secondary" disabled={!connected || busy || !name.trim() || !roomCode.trim()}>
            加入房间
          </button>
        </div>
      </form>

      {!connected && <p className="hint">正在连接信令服务器…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
