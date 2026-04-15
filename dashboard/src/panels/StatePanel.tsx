import { useEffect, useState } from 'react';

interface Props {
  apiUrl: string;
}

interface ChainState {
  verifiedRootHash: string;
  blockHeight: number | null;
  chainId: string | null;
  lastBlockTime: string | null;
  validatorCount: number | null;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: ChainState; latencyMs: number }
  | { kind: 'error'; message: string };

async function readJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export function StatePanel({ apiUrl }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  const load = async () => {
    setState({ kind: 'loading' });
    const started = performance.now();
    try {
      // Fetch the verified (consensus-anchored) root hash
      const rootRes = await readJson(`${apiUrl}/state/root-hash/verified`);
      const verifiedRootHash =
        rootRes?.data?.root_hash ??
        rootRes?.data?.rootHash ??
        rootRes?.root_hash ??
        '';

      let blockHeight: number | null = null;
      let chainId: string | null = null;
      let lastBlockTime: string | null = null;
      let validatorCount: number | null = null;

      // CometBFT status — try both the derived port and common ports
      const cometUrls = [
        apiUrl.replace(/\/willow-api$/, '').replace(/:\d+(\/)?$/, ':26657'),
        'http://127.0.0.1:26657',
      ];
      for (const cometUrl of cometUrls) {
        try {
          const statusBody = await readJson(`${cometUrl}/status`);
          const syncInfo = statusBody?.result?.sync_info ?? statusBody?.sync_info;
          if (syncInfo) {
            blockHeight = Number(syncInfo.latest_block_height);
            lastBlockTime = syncInfo.latest_block_time ?? null;
          }
          chainId =
            statusBody?.result?.node_info?.network ??
            statusBody?.node_info?.network ??
            null;
          break;
        } catch {
          continue;
        }
      }

      // Validator count
      try {
        const valRes = await readJson(`${apiUrl}/validators`);
        const vals = valRes?.data ?? valRes?.validators ?? valRes;
        if (Array.isArray(vals)) validatorCount = vals.length;
      } catch {
        // optional
      }

      const latencyMs = Math.round(performance.now() - started);
      setState({
        kind: 'ok',
        data: { verifiedRootHash, blockHeight, chainId, lastBlockTime, validatorCount },
        latencyMs,
      });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  return (
    <section className="panel">
      <h2>Chain state</h2>
      <p className="panel-description">
        Shows the CometBFT-verified state root hash (the consensus-anchored app hash), current
        block height, and chain metadata. Auto-refreshes every 5 seconds.
      </p>

      {state.kind === 'loading' && <p className="subtle">Loading…</p>}

      {state.kind === 'error' && (
        <div className="result" data-testid="state-error">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="result" data-testid="state-result">
          <div className="result-header">
            <span className="badge badge-ok">✓ connected</span>
            <div className="result-header-right">
              <span className="result-latency">{state.latencyMs} ms</span>
            </div>
          </div>
          <div className="result-body">
            <dl className="kv-list">
              <dt>verified state root</dt>
              <dd>
                <code data-testid="state-root-verified">
                  {state.data.verifiedRootHash || '(unavailable)'}
                </code>
              </dd>
              {state.data.blockHeight !== null && (
                <>
                  <dt>block height</dt>
                  <dd>
                    <code>{state.data.blockHeight.toLocaleString()}</code>
                  </dd>
                </>
              )}
              {state.data.chainId && (
                <>
                  <dt>chain id</dt>
                  <dd>
                    <code>{state.data.chainId}</code>
                  </dd>
                </>
              )}
              {state.data.validatorCount !== null && (
                <>
                  <dt>validators</dt>
                  <dd>{state.data.validatorCount}</dd>
                </>
              )}
              {state.data.lastBlockTime && (
                <>
                  <dt>last block</dt>
                  <dd>{new Date(state.data.lastBlockTime).toLocaleTimeString()}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
