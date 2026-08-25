import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { RoomPeer } from '@airdrop/shared';
import type { ChatItem, TransferProgress } from '../hooks/useAirdrop';
import { formatBytes, formatTime } from '../lib/utils';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

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
    dropRef.current?.classList.remove('dragover');
    if (e.dataTransfer.files?.length) {
      void onSendFiles(e.dataTransfer.files, target === 'all' ? 'all' : [target]);
    }
  }

  return (
    <div className="room">
      <header className="room__header">
        <div>
          <p className="landing__eyebrow">房间</p>
          <h1 className="room__code mono">{roomId}</h1>
          <p className="room__you">
            你是 <strong>{name}</strong>
          </p>
        </div>
        <div className="room__share">
          <button type="button" className="secondary" onClick={() => void copyLink()}>
            {copied ? '已复制' : '复制链接'}
          </button>
          <button type="button" className="secondary" onClick={() => setShowQr((v) => !v)}>
            {showQr ? '隐藏二维码' : '显示二维码'}
          </button>
          <button type="button" className="ghost" onClick={onLeave}>
            离开
          </button>
        </div>
      </header>

      {showQr && (
        <div className="qr-block panel">
          <QRCodeSVG value={shareUrl} size={148} bgColor="transparent" fgColor="currentColor" />
          <div>
            <p>扫码或打开链接加入同一房间</p>
            <p className="mono small break">{shareUrl}</p>
          </div>
        </div>
      )}

      <div className="room__grid">
        <aside className="panel peers">
          <h2>设备</h2>
          <ul>
            <li className="peer me">
              <span className="dot on" />
              {name}（我）
            </li>
            {peers.map((p) => {
              const ready = readyPeers.includes(p.peerId);
              return (
                <li key={p.peerId} className="peer">
                  <span className={`dot ${ready ? 'on' : ''}`} />
                  <span>{p.name}</span>
                  <span className="muted small">{ready ? '已连接' : '连接中…'}</span>
                </li>
              );
            })}
            {peers.length === 0 && <li className="muted">等待其他设备加入…</li>}
          </ul>
        </aside>

        <section className="panel feed" ref={dropRef} onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('dragover'); }} onDragLeave={() => dropRef.current?.classList.remove('dragover')} onDrop={onDrop}>
          <h2>传输记录</h2>
          <div className="feed__list">
            {items.length === 0 && <p className="muted">还没有内容。输入文本或拖入文件开始分享。</p>}
            {items.map((item) => (
              <article key={item.id} className={`bubble ${item.mine ? 'mine' : ''}`}>
                <header>
                  <strong>{item.mine ? '我' : item.fromName}</strong>
                  <time>{formatTime(item.ts)}</time>
                </header>
                {item.kind === 'text' ? (
                  <p className="bubble__text">{item.text}</p>
                ) : (
                  <FilePreview item={item} />
                )}
              </article>
            ))}
          </div>

          {progress.length > 0 && (
            <div className="progress-list">
              {progress.map((p) => (
                <div key={`${p.transferId}-${p.peerId}-${p.direction}`} className="progress">
                  <span>
                    {p.direction === 'send' ? '发送' : '接收'} {p.name}
                  </span>
                  <div className="bar">
                    <i style={{ width: `${Math.min(100, (p.received / Math.max(p.total, 1)) * 100)}%` }} />
                  </div>
                  <span className="mono small">
                    {formatBytes(p.received)} / {formatBytes(p.total)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <form className="composer" onSubmit={handleSend}>
            <div className="composer__row">
              <label className="field inline">
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
              <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
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
            <div className="composer__actions">
              <span className="muted small">⌘/Ctrl + Enter 发送 · 可拖拽文件到此区域</span>
              <button type="submit" disabled={!text.trim() || readyPeers.length === 0}>
                发送文本
              </button>
            </div>
          </form>
        </section>
      </div>

      {error && (
        <p className="error" role="alert" onClick={onClearError}>
          {error}
        </p>
      )}
      <p className="sr-only">local peer {peerId}</p>
    </div>
  );
}

function FilePreview({ item }: { item: Extract<ChatItem, { kind: 'file' }> }) {
  const isImage = item.mime.startsWith('image/');
  const isVideo = item.mime.startsWith('video/');
  const isAudio = item.mime.startsWith('audio/');

  return (
    <div className="file-card">
      {isImage && <img src={item.url} alt={item.name} />}
      {isVideo && <video src={item.url} controls playsInline />}
      {isAudio && <audio src={item.url} controls />}
      <div className="file-meta">
        <span className="file-name">{item.name}</span>
        <span className="muted small">{formatBytes(item.size)}</span>
        <a href={item.url} download={item.name} className="link">
          下载
        </a>
      </div>
    </div>
  );
}
