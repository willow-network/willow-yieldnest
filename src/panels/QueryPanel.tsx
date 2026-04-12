import { useState } from 'react';
import { getClient } from '../lib/client';

interface Props {
  apiUrl: string;
  onOpenInInspector?: (proofHex: string) => void;
}

type QueryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'ok';
      verified: boolean;
      documents: unknown[];
      proof?: string;
      totalMs: number;
    }
  | { kind: 'error'; message: string };

export function QueryPanel({ apiUrl, onOpenInInspector }: Props) {
  const [subgroveId, setSubgroveId] = useState('');
  const [filterJson, setFilterJson] = useState('{}');
  const [limit, setLimit] = useState(10);
  const [verify, setVerify] = useState(true);
  const [state, setState] = useState<QueryState>({ kind: 'idle' });

  const run = async () => {
    if (!subgroveId) {
      setState({ kind: 'error', message: 'subgrove id is required' });
      return;
    }
    let filters: Record<string, unknown> = {};
    if (filterJson.trim()) {
      try {
        filters = JSON.parse(filterJson);
        if (typeof filters !== 'object' || Array.isArray(filters) || filters === null) {
          throw new Error('filters must be a JSON object');
        }
      } catch (err) {
        setState({
          kind: 'error',
          message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
    }

    setState({ kind: 'loading' });
    const client = getClient(apiUrl);
    const started = performance.now();
    try {
      const response = verify
        ? await client.data.query(subgroveId, { filters, limit })
        : await client.data.queryUnverified(subgroveId, { filters, limit });
      const totalMs = Math.round(performance.now() - started);
      setState({
        kind: 'ok',
        verified: verify,
        documents: response.documents ?? [],
        proof: response.proof,
        totalMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', message });
    }
  };

  return (
    <section className="panel">
      <h2>Range query</h2>
      <p className="panel-description">
        Runs <code>POST /query/:subgrove</code> with optional filters and limit. When
        verification is on, the SDK requests an inline proof, runs the pure-TS verifier, and
        compares the computed root to the light client's trusted root.
      </p>

      <div className="form-row">
        <label className="form-field">
          <span>subgrove id</span>
          <input
            value={subgroveId}
            onChange={(e) => setSubgroveId(e.target.value)}
            placeholder="my-subgrove"
            spellCheck={false}
            data-testid="query-subgrove"
          />
        </label>
        <label className="form-field" style={{ flex: '0 0 120px' }}>
          <span>limit</span>
          <input
            type="number"
            value={limit}
            min={1}
            max={1000}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
            data-testid="query-limit"
          />
        </label>
      </div>

      <label className="form-field">
        <span>filters (JSON object, empty = match all)</span>
        <textarea
          value={filterJson}
          onChange={(e) => setFilterJson(e.target.value)}
          rows={3}
          placeholder='{"field": "value"}'
          spellCheck={false}
          data-testid="query-filters"
        />
      </label>

      <div className="form-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={verify}
            onChange={(e) => setVerify(e.target.checked)}
            data-testid="query-verify-toggle"
          />
          Verify proof (trustless)
        </label>
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={state.kind === 'loading'}
          data-testid="query-run"
        >
          {state.kind === 'loading' ? 'Running…' : 'Run query'}
        </button>
      </div>

      {state.kind === 'ok' && (
        <div className="result" data-testid="query-result">
          <div className="result-header">
            {state.verified ? (
              <span className="badge badge-ok">✓ proof verified</span>
            ) : (
              <span className="badge badge-warn">⚠ unverified</span>
            )}
            <div className="result-header-right">
              <span>{state.documents.length} documents</span>
              <span className="result-latency">{state.totalMs} ms</span>
            </div>
          </div>
          <pre className="result-body">{JSON.stringify(state.documents, null, 2)}</pre>
          {state.proof && (
            <>
              <details className="collapsible">
                <summary className="collapsible-header">
                  Proof hex ({state.proof.length / 2} bytes)
                </summary>
                <div className="collapsible-body">
                  <code>{state.proof}</code>
                </div>
              </details>
              {onOpenInInspector && (
                <div className="form-row" style={{ marginTop: '0.75rem' }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => onOpenInInspector(state.proof!)}
                    data-testid="query-open-in-inspector"
                  >
                    Open proof in Inspector →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="result" data-testid="query-error">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}
    </section>
  );
}
