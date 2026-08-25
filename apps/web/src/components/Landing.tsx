import { useMemo, useState, type FormEvent } from 'react';
import { normalizeRoomCode } from '@airdrop/shared';
import { createPeerId } from '../lib/utils';
import ui from '../styles/ui.module.css';
import styles from './Landing.module.css';

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
    <div className={styles.landing}>
      <header className={styles.brand}>
        <p className={ui.eyebrow}>P2P · WebRTC</p>
        <h1 className={ui.title}>Web AirDrop</h1>
        <p className={ui.sub}>在设备之间直传文本、图片与音视频。文件不经服务器中转。</p>
      </header>

      <form className={ui.panel} onSubmit={handleCreate}>
        <label className={ui.field}>
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

        <div className={ui.actions}>
          <button type="submit" className={ui.btn} disabled={!connected || busy || !name.trim()}>
            创建房间
          </button>
        </div>
      </form>

      <form className={ui.panel} onSubmit={handleJoin}>
        <label className={ui.field}>
          <span>房间码</span>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="6 位房间码"
            maxLength={8}
            spellCheck={false}
            className={ui.mono}
          />
        </label>
        <div className={ui.actions}>
          <button
            type="submit"
            className={ui.btnSecondary}
            disabled={!connected || busy || !name.trim() || !roomCode.trim()}
          >
            加入房间
          </button>
        </div>
      </form>

      {!connected && <p className={ui.hint}>正在连接信令服务器…</p>}
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
