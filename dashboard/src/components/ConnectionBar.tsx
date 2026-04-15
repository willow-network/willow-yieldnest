import { useEffect, useState } from 'react';

interface Props {
  apiUrl: string;
  indexerUrl: string;
  onApiUrlChange: (url: string) => void;
  onIndexerUrlChange: (url: string) => void;
}

type HealthState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; apiMs: number; indexerMs: number | null }
  | { kind: 'error'; message: string };

async function ping(url: string, path: string): Promise<number> {
  const started = performance.now();
  const res = await fetch(`${url}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Math.round(performance.now() - started);
}

export function ConnectionBar({
  apiUrl,
  indexerUrl,
  onApiUrlChange,
  onIndexerUrlChange,
}: Props) {
  const [apiDraft, setApiDraft] = useState(apiUrl);
  const [indexerDraft, setIndexerDraft] = useState(indexerUrl);
  const [health, setHealth] = useState<HealthState>({ kind: 'idle' });

  useEffect(() => setApiDraft(apiUrl), [apiUrl]);
  useEffect(() => setIndexerDraft(indexerUrl), [indexerUrl]);

  const check = async () => {
    setHealth({ kind: 'checking' });
    try {
      const apiMs = await ping(apiUrl, '/state/root-hash');
      let indexerMs: number | null = null;
      if (indexerUrl) {
        try {
          indexerMs = await ping(indexerUrl, '/health');
        } catch {
          // Indexer health endpoint may not exist — try a different path
          try {
            indexerMs = await ping(indexerUrl, '/');
          } catch {
            indexerMs = null;
          }
        }
      }
      setHealth({ kind: 'ok', apiMs, indexerMs });
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
        Validator
        <input
          className="connection-input"
          value={apiDraft}
          onChange={(e) => setApiDraft(e.target.value)}
          onBlur={() => onApiUrlChange(apiDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onApiUrlChange(apiDraft);
          }}
          spellCheck={false}
        />
      </label>
      <label className="connection-label">
        Indexer
        <input
          className="connection-input"
          value={indexerDraft}
          onChange={(e) => setIndexerDraft(e.target.value)}
          onBlur={() => onIndexerUrlChange(indexerDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onIndexerUrlChange(indexerDraft);
          }}
          placeholder="(optional — auto-discovered if blank)"
          spellCheck={false}
        />
      </label>
      <button className="btn" onClick={check} disabled={health.kind === 'checking'}>
        {health.kind === 'checking' ? '…' : 'Check'}
      </button>
      <div className="connection-status">
        {health.kind === 'idle' && <span className="status-idle">not checked</span>}
        {health.kind === 'checking' && <span className="status-idle">…</span>}
        {health.kind === 'ok' && (
          <span className="status-ok">
            ● validator {health.apiMs}ms
            {health.indexerMs !== null && ` · indexer ${health.indexerMs}ms`}
          </span>
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
