import { useEffect, useState } from 'react';
import { grovedb } from '@willow/sdk';
import { getClient } from '../lib/client';

const { verifyGroveDBProof, hexToBytes, hashToHex } = grovedb;

interface Props {
  apiUrl: string;
  prefillSubgrove?: string | null;
  onPrefillConsumed?: () => void;
  onOpenInInspector?: (proofHex: string) => void;
}

interface SuccessState {
  kind: 'ok';
  data: unknown;
  verified: boolean;
  proofHex: string | null;
  computedRoot: string | null;
  timings: {
    totalMs: number;
    fetchDataMs: number;
    fetchProofMs: number;
    verifyMs: number;
  };
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | SuccessState
  | { kind: 'error'; message: string; code?: string };

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return res.json();
}

export function DataPanel({
  apiUrl,
  prefillSubgrove,
  onPrefillConsumed,
  onOpenInInspector,
}: Props) {
  const [subgroveId, setSubgroveId] = useState('');
  const [key, setKey] = useState('');
  const [verify, setVerify] = useState(true);
  const [state, setState] = useState<FetchState>({ kind: 'idle' });

  useEffect(() => {
    if (prefillSubgrove) {
      setSubgroveId(prefillSubgrove);
      onPrefillConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSubgrove]);

  const fetchData = async () => {
    if (!subgroveId || !key) {
      setState({ kind: 'error', message: 'subgrove and key are required' });
      return;
    }
    setState({ kind: 'loading' });
    const client = getClient(apiUrl);
    const totalStart = performance.now();

    try {
      if (!verify) {
        const fetchStart = performance.now();
        const data = await client.data.getDataUnverified(subgroveId, key);
        const fetchDataMs = performance.now() - fetchStart;
        setState({
          kind: 'ok',
          data,
          verified: false,
          proofHex: null,
          computedRoot: null,
          timings: {
            totalMs: performance.now() - totalStart,
            fetchDataMs,
            fetchProofMs: 0,
            verifyMs: 0,
          },
        });
        return;
      }

      // Verified path — fetch data + proof manually so we can surface timings
      // and the proof hex in the UI. The high-level client.data.getData() does
      // the same work internally but hides the breakdown.
      const fetchDataStart = performance.now();
      const dataRes = await fetchJson(
        `${apiUrl}/data/${encodeURIComponent(subgroveId)}/${encodeURIComponent(key)}`,
      );
      const fetchDataMs = performance.now() - fetchDataStart;
      if (!dataRes?.success) {
        throw new Error(dataRes?.error || 'Data not found');
      }
      const data = dataRes.data;

      const fetchProofStart = performance.now();
      const proofRes = await fetchJson(
        `${apiUrl}/proof/${encodeURIComponent(subgroveId)}/${encodeURIComponent(key)}`,
      );
      const fetchProofMs = performance.now() - fetchProofStart;
      if (!proofRes?.success || !proofRes?.data?.proof) {
        throw new Error(proofRes?.error || 'Proof not available');
      }
      const proofHex: string = proofRes.data.proof;

      const verifyStart = performance.now();
      const result = verifyGroveDBProof(hexToBytes(proofHex));
      const computedRoot = hashToHex(result.rootHash);
      const verifyMs = performance.now() - verifyStart;

      setState({
        kind: 'ok',
        data,
        verified: true,
        proofHex,
        computedRoot,
        timings: {
          totalMs: performance.now() - totalStart,
          fetchDataMs,
          fetchProofMs,
          verifyMs,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      setState({ kind: 'error', message, code });
    }
  };

  return (
    <section className="panel">
      <h2>Fetch data by key</h2>
      <p className="panel-description">
        Reads a single (subgrove, key) pair from the Willow API. When verification is on, the
        proof is fetched from <code>/proof/:subgrove/:key</code> and decoded with the pure-TS
        GroveDB verifier. Timings, the computed root hash, and the raw proof bytes are all
        surfaced so you can see what the verifier actually does.
      </p>

      <div className="form-row">
        <label className="form-field">
          <span>subgrove id</span>
          <input
            value={subgroveId}
            onChange={(e) => setSubgroveId(e.target.value)}
            placeholder="my-subgrove"
            spellCheck={false}
            data-testid="data-subgrove"
          />
        </label>
        <label className="form-field">
          <span>key</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="user:alice"
            spellCheck={false}
            data-testid="data-key"
          />
        </label>
      </div>

      <div className="form-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={verify}
            onChange={(e) => setVerify(e.target.checked)}
            data-testid="data-verify-toggle"
          />
          Verify proof (trustless)
        </label>
        <button
          className="btn btn-primary"
          onClick={fetchData}
          disabled={state.kind === 'loading'}
          data-testid="data-fetch"
        >
          {state.kind === 'loading' ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {state.kind === 'ok' && (
        <div className="result" data-testid="data-result">
          <div className="result-header">
            {state.verified ? (
              <span className="badge badge-ok">✓ proof verified</span>
            ) : (
              <span className="badge badge-warn">⚠ unverified</span>
            )}
            <div className="result-header-right">
              <span className="result-latency">
                total {state.timings.totalMs.toFixed(0)} ms
              </span>
            </div>
          </div>
          <div className="result-body">
            <h3 style={{ marginTop: 0 }}>Data</h3>
            <pre
              style={{ margin: 0, background: 'var(--bg)', padding: '0.5rem', borderRadius: 4 }}
            >
              {JSON.stringify(state.data, null, 2)}
            </pre>

            {state.verified && (
              <>
                <h3>Verification</h3>
                <dl className="kv-list">
                  <dt>computed root</dt>
                  <dd>
                    <code data-testid="data-computed-root">{state.computedRoot}</code>
                  </dd>
                  <dt>proof size</dt>
                  <dd>
                    {state.proofHex ? `${state.proofHex.length / 2} bytes` : '—'}
                  </dd>
                </dl>
                <div className="timing-row">
                  <span>
                    fetch data <strong>{state.timings.fetchDataMs.toFixed(0)} ms</strong>
                  </span>
                  <span>
                    fetch proof <strong>{state.timings.fetchProofMs.toFixed(0)} ms</strong>
                  </span>
                  <span>
                    verify <strong>{state.timings.verifyMs.toFixed(2)} ms</strong>
                  </span>
                </div>

                {state.proofHex && (
                  <>
                    <details className="collapsible">
                      <summary className="collapsible-header">
                        Raw proof hex ({state.proofHex.length / 2} bytes)
                      </summary>
                      <div className="collapsible-body">
                        <code>{state.proofHex}</code>
                      </div>
                    </details>
                    {onOpenInInspector && (
                      <div className="form-row" style={{ marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => onOpenInInspector(state.proofHex!)}
                          data-testid="data-open-in-inspector"
                        >
                          Open proof in Inspector →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="result" data-testid="data-error">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
            {state.code && (
              <div className="result-header-right">
                <code>{state.code}</code>
              </div>
            )}
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}
    </section>
  );
}
