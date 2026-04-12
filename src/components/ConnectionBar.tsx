import { useEffect, useState } from 'react';

interface Props {
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
}

type HealthState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; latencyMs: number }
  | { kind: 'error'; message: string };

export function ConnectionBar({ apiUrl, onApiUrlChange }: Props) {
  const [draft, setDraft] = useState(apiUrl);
  const [health, setHealth] = useState<HealthState>({ kind: 'idle' });

  useEffect(() => {
    setDraft(apiUrl);
  }, [apiUrl]);

  const check = async () => {
    setHealth({ kind: 'checking' });
    const started = performance.now();
    try {
      const res = await fetch(`${apiUrl}/state/root-hash`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const latencyMs = Math.round(performance.now() - started);
      setHealth({ kind: 'ok', latencyMs });
    } catch (err) {
      setHealth({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="connection-bar">
      <label className="connection-label">
        API
        <input
          className="connection-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onApiUrlChange(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onApiUrlChange(draft);
          }}
          spellCheck={false}
        />
      </label>
      <button className="btn" onClick={check} disabled={health.kind === 'checking'}>
        {health.kind === 'checking' ? 'Checking…' : 'Check'}
      </button>
      <div className="connection-status">
        {health.kind === 'idle' && <span className="status-idle">not checked</span>}
        {health.kind === 'checking' && <span className="status-idle">…</span>}
        {health.kind === 'ok' && (
          <span className="status-ok">● online ({health.latencyMs} ms)</span>
        )}
        {health.kind === 'error' && (
          <span className="status-err" title={health.message}>
            ● offline
          </span>
        )}
      </div>
    </div>
  );
}
