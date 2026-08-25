import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClipboardId } from '@airdrop/shared';
import ui from '../styles/ui.module.css';

export function ClipboardRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/clipboard/${generateClipboardId()}`, { replace: true });
  }, [navigate]);
  return (
    <div className={ui.shell}>
      <p className={ui.hint}>正在生成剪切板 ID…</p>
    </div>
  );
}
