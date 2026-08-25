import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  generateClipboardId,
  isValidClipboardId,
  normalizeClipboardId,
  type ClipboardPayload,
} from '@airdrop/shared';
import { formatBytes, formatTime } from '../lib/utils';
import ui from '../styles/ui.module.css';
import styles from './ClipboardPage.module.css';

export function ClipboardPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = useMemo(() => normalizeClipboardId(rawId ?? ''), [rawId]);

  const [draftId, setDraftId] = useState(id);
  const [localText, setLocalText] = useState('');
  const [remote, setRemote] = useState<ClipboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftId(id);
  }, [id]);

  useEffect(() => {
    if (!isValidClipboardId(id)) {
      navigate(`/clipboard/${generateClipboardId()}`, { replace: true });
    }
  }, [id, navigate]);

  const fetchRemote = useCallback(async () => {
    if (!isValidClipboardId(id)) return;
    try {
      const res = await fetch(`/api/clipboard/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      setRemote(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, [id]);

  useEffect(() => {
    void fetchRemote();
  }, [fetchRemote]);

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.pathname = `/clipboard/${id}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }, [id]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function applyId(e: FormEvent) {
    e.preventDefault();
    const next = normalizeClipboardId(draftId);
    if (!isValidClipboardId(next)) {
      setError('ID 需为 4–16 位字母数字');
      return;
    }
    navigate(`/clipboard/${next}`);
  }

  async function saveText() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clipboard/${id}/text`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: localText }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      setRemote(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function clearText() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clipboard/${id}/text`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      setRemote(data);
      setLocalText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '清除失败');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      const res = await fetch(`/api/clipboard/${id}/files`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      setRemote(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteFile(fileId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clipboard/${id}/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      setRemote(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm('确定清空该剪切板的全部内容？')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clipboard/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setRemote({ id, text: '', files: [], updatedAt: 0 });
      setLocalText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '清空失败');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  function loadRemoteIntoEditor() {
    setLocalText(remote?.text ?? '');
  }

  return (
    <div className={ui.shell}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>服务端存储</p>
          <h1 className={ui.titleSm}>网络剪切板</h1>
          <p className={ui.sub}>同 ID 的设备共享文本与文件；保存后对端点「刷新」即可看到。</p>
        </div>
        <div className={ui.pageShare}>
          <button type="button" className={ui.btnSecondary} onClick={() => void copyLink()}>
            {copied ? '已复制' : '复制链接'}
          </button>
          <button type="button" className={ui.btnGhost} disabled={busy} onClick={() => void clearAll()}>
            清空全部
          </button>
        </div>
      </header>

      <form className={ui.panel} onSubmit={applyId}>
        <label className={ui.field}>
          <span>剪切板 ID（可改 URL 或在此切换）</span>
          <div className={ui.composerRow}>
            <input
              className={ui.mono}
              value={draftId}
              onChange={(e) => setDraftId(e.target.value.toUpperCase())}
              maxLength={16}
              spellCheck={false}
            />
            <button type="submit" className={ui.btnSecondary}>
              切换
            </button>
            <button
              type="button"
              className={ui.btnSecondary}
              onClick={() => navigate(`/clipboard/${generateClipboardId()}`)}
            >
              新 ID
            </button>
          </div>
        </label>
        <p className={`${ui.mono} ${ui.small} ${ui.break} ${ui.muted}`}>{shareUrl}</p>
      </form>

      <div className={styles.grid}>
        <section className={ui.panel}>
          <h2 className={ui.sectionTitle}>写入文本</h2>
          <textarea
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            placeholder="在此输入要同步的文本，点保存后对端可见…"
            rows={8}
          />
          <div className={`${ui.composerActions} ${styles.editorActions}`}>
            <button type="button" className={ui.btnSecondary} onClick={loadRemoteIntoEditor} disabled={!remote?.text}>
              载入远端文本
            </button>
            <div className={ui.actions}>
              <button type="button" className={ui.btnGhost} disabled={busy} onClick={() => void clearText()}>
                清除远端文本
              </button>
              <button type="button" className={ui.btn} disabled={busy} onClick={() => void saveText()}>
                保存文本
              </button>
            </div>
          </div>
        </section>

        <section
          className={`${ui.panel} ${styles.feed} ${dragOver ? styles.feedDragover : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <h2 className={ui.sectionTitle}>上传文件</h2>
          <p className={`${ui.muted} ${ui.small}`}>拖拽到此处，或选择文件（单文件 ≤ 20MB）</p>
          <div className={`${ui.actions} ${styles.uploadActions}`}>
            <button type="button" className={ui.btnSecondary} disabled={busy} onClick={() => fileRef.current?.click()}>
              选择文件
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
            />
          </div>
        </section>
      </div>

      <section className={`${ui.panel} ${styles.remoteSection}`}>
        <div className={ui.composerRow}>
          <h2 className={ui.sectionTitleFlush}>远端内容</h2>
          <div className={ui.actions}>
            {remote?.updatedAt ? (
              <span className={`${ui.muted} ${ui.small}`}>更新于 {formatTime(remote.updatedAt)}</span>
            ) : (
              <span className={`${ui.muted} ${ui.small}`}>尚无内容</span>
            )}
            <button type="button" className={ui.btnSecondary} disabled={busy} onClick={() => void fetchRemote()}>
              刷新
            </button>
          </div>
        </div>

        {remote?.text ? (
          <article className={`${ui.bubble} ${styles.remoteTextBubble}`}>
            <header className={ui.bubbleHeader}>
              <strong>文本</strong>
              <button type="button" className={ui.btnGhostCompact} onClick={() => void clearText()}>
                删除
              </button>
            </header>
            <p className={ui.bubbleText}>{remote.text}</p>
          </article>
        ) : (
          <p className={`${ui.muted} ${styles.emptyRemote}`}>暂无远端文本</p>
        )}

        <div className={styles.feedList}>
          {(remote?.files ?? []).map((f) => {
            const url = `/api/clipboard/${id}/files/${f.id}`;
            const isImage = f.mime.startsWith('image/');
            const isVideo = f.mime.startsWith('video/');
            const isAudio = f.mime.startsWith('audio/');
            return (
              <article key={f.id} className={ui.bubble}>
                <header className={ui.bubbleHeader}>
                  <strong>{f.name}</strong>
                  <span className={`${ui.muted} ${ui.small}`}>{formatBytes(f.size)}</span>
                </header>
                <div className={ui.fileCard}>
                  {isImage && <img src={url} alt={f.name} />}
                  {isVideo && <video src={url} controls playsInline />}
                  {isAudio && <audio src={url} controls />}
                  <div className={ui.fileMeta}>
                    <a className={ui.link} href={url} download={f.name}>
                      下载
                    </a>
                    <button
                      type="button"
                      className={ui.btnGhostCompact}
                      disabled={busy}
                      onClick={() => void deleteFile(f.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {remote && remote.files.length === 0 && <p className={ui.muted}>暂无文件</p>}
        </div>
      </section>

      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
