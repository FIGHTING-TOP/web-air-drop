import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isValidClipboardId, normalizeClipboardId, type ClipboardPayload } from '@airdrop/shared';
import { formatBytes, formatTime } from '../lib/utils';
import ui from '../styles/ui.module.css';
import styles from '../components/ManagePage.module.css';

export function ManageDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = useMemo(() => normalizeClipboardId(rawId ?? ''), [rawId]);
  const apiBase = useMemo(() => `/api/clipboard/${encodeURIComponent(id)}`, [id]);

  const [remote, setRemote] = useState<ClipboardPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isValidClipboardId(id)) {
      navigate('/manage/list', { replace: true });
    }
  }, [id, navigate]);

  const load = useCallback(async () => {
    if (!isValidClipboardId(id)) return;
    try {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      setRemote(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败');
    }
  }, [apiBase, id, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteText() {
    if (!confirm('确定删除该剪切板下的文本记录？')) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/text`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      if (!data.text && data.files.length === 0 && data.updatedAt === 0) {
        navigate('/manage/list', { replace: true });
        return;
      }
      setRemote(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除文本失败');
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: string, name: string) {
    if (!confirm(`确定删除文件「${name}」？`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardPayload;
      if (!data.text && data.files.length === 0 && data.updatedAt === 0) {
        navigate('/manage/list', { replace: true });
        return;
      }
      setRemote(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除文件失败');
    } finally {
      setBusy(false);
    }
  }

  async function deleteClipboard() {
    if (!confirm(`确定删除剪切板「${id}」及其全部内容？`)) return;
    setBusy(true);
    try {
      const res = await fetch(apiBase, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      navigate('/manage/list', { replace: true });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败');
      setBusy(false);
    }
  }

  return (
    <div className={ui.shell}>
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <div className={styles.detailHeader}>
        <div>
          <p className={ui.eyebrow}>管理 · 详情</p>
          <h1 className={`${ui.titleSm} ${ui.mono}`}>{id}</h1>
          <p className={ui.sub}>
            {remote?.updatedAt ? `更新于 ${formatTime(remote.updatedAt)}` : '查看并删除该 ID 下的记录'}
          </p>
        </div>
        <div className={ui.pageShare}>
          <Link to="/manage/list" className={ui.btnSecondary}>
            返回列表
          </Link>
          <Link to={`/${encodeURIComponent(id)}`} className={ui.btnSecondary}>
            打开剪切板页
          </Link>
          <button type="button" className={ui.btnGhost} disabled={busy} onClick={() => void deleteClipboard()}>
            删除整个 ID
          </button>
        </div>
      </div>

      <div className={styles.records}>
        <section className={ui.panel}>
          <h2 className={ui.sectionTitle}>文本记录</h2>
          {remote?.text ? (
            <>
              <p className={ui.bubbleText}>{remote.text}</p>
              <div className={styles.recordActions}>
                <button type="button" className={ui.btnGhostCompact} disabled={busy} onClick={() => void deleteText()}>
                  删除文本
                </button>
              </div>
            </>
          ) : (
            <p className={styles.empty}>暂无文本</p>
          )}
        </section>

        <section className={ui.panel}>
          <h2 className={ui.sectionTitle}>文件记录（{remote?.files.length ?? 0}）</h2>
          {(remote?.files ?? []).length === 0 && <p className={styles.empty}>暂无文件</p>}
          <div className={styles.records}>
            {(remote?.files ?? []).map((f) => {
              const url = `${apiBase}/files/${f.id}`;
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
                      <span className={`${ui.muted} ${ui.small}`}>{f.mime}</span>
                      <a className={ui.link} href={url} download={f.name}>
                        下载
                      </a>
                      <button
                        type="button"
                        className={ui.btnGhostCompact}
                        disabled={busy}
                        onClick={() => void deleteFile(f.id, f.name)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
