import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClipboardId } from '@airdrop/shared';

export function ClipboardRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/clipboard/${generateClipboardId()}`, { replace: true });
  }, [navigate]);
  return (
    <div className="shell">
      <p className="hint">正在生成剪切板 ID…</p>
    </div>
  );
}
