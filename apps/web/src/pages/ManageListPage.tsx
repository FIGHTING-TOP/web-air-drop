import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ClipboardSummary } from '@airdrop/shared';
import { formatBytes } from '../lib/utils';
import ui from '../styles/ui.module.css';
import styles from '../components/ManagePage.module.css';

function formatUpdatedAt(ts: number): string {
  if (!ts) return '未知';
  return new Date(ts).toLocaleString();
}

export function ManageListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClipboardSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/clipboard');
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClipboardSummary[];
      setItems(data);
      setSelected(new Set());
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败');
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(items.map((x) => x.id)));
  }

  async function deleteOne(id: string) {
    if (!confirm(`确定删除剪切板「${id}」及其全部内容？`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clipboard/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  async function batchDelete() {
    const ids = [...selected];
    if (ids.length === 0) {
      showToast('请先勾选要删除的剪切板 ID');
      return;
    }
    if (!confirm(`确定批量删除 ${ids.length} 个剪切板及其全部内容？`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/clipboard/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '批量删除失败');
    } finally {
      setBusy(false);
    }
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className={ui.shell}>
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>管理</p>
          <h1 className={ui.titleSm}>剪切板存储</h1>
          <p className={ui.sub}>查看 staticStorage 中已有的剪切板 ID，点击进入详情。</p>
        </div>
        <div className={ui.pageShare}>
          <Link to="/" className={ui.btnSecondary}>
            打开剪切板
          </Link>
          <button type="button" className={ui.btnSecondary} disabled={busy} onClick={() => void load()}>
            刷新
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={allSelected}
            disabled={items.length === 0 || busy}
            onChange={(e) => toggleAll(e.target.checked)}
          />
          全选（{selected.size}/{items.length}）
        </label>
        <button
          type="button"
          className={ui.btnGhost}
          disabled={busy || selected.size === 0}
          onClick={() => void batchDelete()}
        >
          批量删除选中
        </button>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>暂无剪切板记录</p>
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <div key={item.id} className={styles.item}>
              <input
                type="checkbox"
                className={styles.itemCheck}
                checked={selected.has(item.id)}
                disabled={busy}
                onChange={(e) => toggleOne(item.id, e.target.checked)}
                aria-label={`选择 ${item.id}`}
              />
              <button
                type="button"
                className={styles.itemMain}
                onClick={() => navigate(`/manage/${encodeURIComponent(item.id)}`)}
              >
                <strong className={ui.mono}>{item.id}</strong>
                <div className={styles.rowMeta}>
                  <span className={`${ui.muted} ${ui.small}`}>
                    文本：{item.hasText ? '有' : '无'}
                  </span>
                  <span className={`${ui.muted} ${ui.small}`}>文件：{item.fileCount}</span>
                  <span className={`${ui.muted} ${ui.small}`}>体积：{formatBytes(item.totalSize)}</span>
                  <span className={`${ui.muted} ${ui.small}`}>更新：{formatUpdatedAt(item.updatedAt)}</span>
                </div>
                {item.hasText && <p className={styles.preview}>{item.textPreview}</p>}
              </button>
              <button
                type="button"
                className={ui.btnGhostCompact}
                disabled={busy}
                onClick={() => void deleteOne(item.id)}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
