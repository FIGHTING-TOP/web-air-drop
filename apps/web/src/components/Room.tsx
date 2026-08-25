import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { RoomPeer } from '@airdrop/shared';
import type { ChatItem, TransferProgress } from '../hooks/useAirdrop';
import { formatBytes, formatTime } from '../lib/utils';
import ui from '../styles/ui.module.css';
import styles from './Room.module.css';

type Props = {
  roomId: string;
  name: string;
  peerId: string;
  peers: RoomPeer[];
  readyPeers: string[];
  items: ChatItem[];
  progress: TransferProgress[];
  error: string | null;
  onLeave: () => void;
  onSendText: (text: string, targets: string[] | 'all') => Promise<void>;
  onSendFiles: (files: FileList | File[], targets: string[] | 'all') => Promise<void>;
  onClearError: () => void;
};

export function Room({
  roomId,
  name,
  peerId,
  peers,
  readyPeers,
  items,
  progress,
  error,
  onLeave,
  onSendText,
  onSendFiles,
  onClearError,
}: Props) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<'all' | string>('all');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    return url.toString();
  }, [roomId]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSendText(text, target === 'all' ? 'all' : [target]);
    setText('');
  }

  function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    void onSendFiles(files, target === 'all' ? 'all' : [target]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      void onSendFiles(e.dataTransfer.files, target === 'all' ? 'all' : [target]);
    }
  }

  return (
    <div>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>房间</p>
          <h1 className={`${styles.roomCode} ${ui.mono}`}>{roomId}</h1>
          <p className={styles.you}>
            你是 <strong>{name}</strong>
          </p>
        </div>
        <div className={ui.pageShare}>
          <button type="button" className={ui.btnSecondary} onClick={() => void copyLink()}>
            {copied ? '已复制' : '复制链接'}
          </button>
          <button type="button" className={ui.btnSecondary} onClick={() => setShowQr((v) => !v)}>
            {showQr ? '隐藏二维码' : '显示二维码'}
          </button>
          <button type="button" className={ui.btnGhost} onClick={onLeave}>
            离开
          </button>
        </div>
      </header>

      {showQr && (
        <div className={`${ui.panel} ${styles.qrBlock}`}>
          <QRCodeSVG value={shareUrl} size={148} bgColor="transparent" fgColor="currentColor" />
          <div>
            <p>扫码或打开链接加入同一房间</p>
            <p className={`${ui.mono} ${ui.small} ${ui.break}`}>{shareUrl}</p>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        <aside className={`${ui.panel} ${styles.peers}`}>
          <h2 className={ui.sectionTitle}>设备</h2>
          <ul>
            <li className={styles.peer}>
              <span className={styles.dotOn} />
              {name}（我）
            </li>
            {peers.map((p) => {
              const ready = readyPeers.includes(p.peerId);
              return (
                <li key={p.peerId} className={styles.peer}>
                  <span className={ready ? styles.dotOn : styles.dot} />
                  <span>{p.name}</span>
                  <span className={`${ui.muted} ${ui.small}`}>{ready ? '已连接' : '连接中…'}</span>
                </li>
              );
            })}
            {peers.length === 0 && <li className={ui.muted}>等待其他设备加入…</li>}
          </ul>
        </aside>

        <section
          className={`${ui.panel} ${styles.feed} ${dragOver ? styles.feedDragover : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <h2 className={ui.sectionTitle}>传输记录</h2>
          <div className={styles.feedList}>
            {items.length === 0 && <p className={ui.muted}>还没有内容。输入文本或拖入文件开始分享。</p>}
            {items.map((item) => (
              <article key={item.id} className={item.mine ? ui.bubbleMine : ui.bubble}>
                <header className={ui.bubbleHeader}>
                  <strong>{item.mine ? '我' : item.fromName}</strong>
                  <time>{formatTime(item.ts)}</time>
                </header>
                {item.kind === 'text' ? (
                  <p className={ui.bubbleText}>{item.text}</p>
                ) : (
                  <FilePreview item={item} />
                )}
              </article>
            ))}
          </div>

          {progress.length > 0 && (
            <div className={styles.progressList}>
              {progress.map((p) => (
                <div key={`${p.transferId}-${p.peerId}-${p.direction}`} className={styles.progress}>
                  <span>
                    {p.direction === 'send' ? '发送' : '接收'} {p.name}
                  </span>
                  <div className={styles.bar}>
                    <i
                      className={styles.barFill}
                      style={{ width: `${Math.min(100, (p.received / Math.max(p.total, 1)) * 100)}%` }}
                    />
                  </div>
                  <span className={`${ui.mono} ${ui.small}`}>
                    {formatBytes(p.received)} / {formatBytes(p.total)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <form className={styles.composer} onSubmit={handleSend}>
            <div className={ui.composerRow}>
              <label className={ui.fieldInline}>
                <span>发送给</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="all">所有已连接设备</option>
                  {peers
                    .filter((p) => readyPeers.includes(p.peerId))
                    .map((p) => (
                      <option key={p.peerId} value={p.peerId}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <button type="button" className={ui.btnSecondary} onClick={() => fileRef.current?.click()}>
                选择文件
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept="image/*,audio/*,video/*,*/*"
                onChange={(e) => onFilesSelected(e.target.files)}
              />
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入要分享的文本…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSend(e);
                }
              }}
            />
            <div className={ui.composerActions}>
              <span className={`${ui.muted} ${ui.small}`}>⌘/Ctrl + Enter 发送 · 可拖拽文件到此区域</span>
              <button type="submit" className={ui.btn} disabled={!text.trim() || readyPeers.length === 0}>
                发送文本
              </button>
            </div>
          </form>
        </section>
      </div>

      {error && (
        <p className={ui.error} role="alert" onClick={onClearError}>
          {error}
        </p>
      )}
      <p className={ui.srOnly}>local peer {peerId}</p>
    </div>
  );
}

function FilePreview({ item }: { item: Extract<ChatItem, { kind: 'file' }> }) {
  const isImage = item.mime.startsWith('image/');
  const isVideo = item.mime.startsWith('video/');
  const isAudio = item.mime.startsWith('audio/');

  return (
    <div className={ui.fileCard}>
      {isImage && <img src={item.url} alt={item.name} />}
      {isVideo && <video src={item.url} controls playsInline />}
      {isAudio && <audio src={item.url} controls />}
      <div className={ui.fileMeta}>
        <span className={ui.fileName}>{item.name}</span>
        <span className={`${ui.muted} ${ui.small}`}>{formatBytes(item.size)}</span>
        <a href={item.url} download={item.name} className={ui.link}>
          下载
        </a>
      </div>
    </div>
  );
}
