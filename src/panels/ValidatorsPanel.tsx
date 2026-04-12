import { useEffect, useState } from 'react';

interface Props {
  apiUrl: string;
}

interface Validator {
  did?: string;
  total_stake?: number | string;
  self_stake?: number | string;
  active?: boolean;
  jailed?: boolean;
  consensus_pubkey?: string;
  [k: string]: unknown;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; validators: Validator[]; rawShape: string }
  | { kind: 'error'; message: string };

export function ValidatorsPanel({ apiUrl }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`${apiUrl}/validators`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const raw = body?.data ?? body?.validators ?? body;
      const validators: Validator[] = Array.isArray(raw) ? raw : [];
      const rawShape = Array.isArray(raw)
        ? 'array'
        : body?.data !== undefined
          ? 'envelope.data'
          : body?.validators !== undefined
            ? 'envelope.validators'
            : 'unknown';
      setState({ kind: 'ok', validators, rawShape });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  return (
    <section className="panel">
      <h2>Validators</h2>
      <p className="panel-description">
        Lists active validators from <code>GET /validators</code>. These are the BFT consensus
        participants whose signatures are verified by the CometBFT light client in the SDK.
      </p>

      <div className="form-row">
        <button className="btn" onClick={load} disabled={state.kind === 'loading'}>
          {state.kind === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {state.kind === 'error' && (
        <div className="result" data-testid="validators-error">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}

      {state.kind === 'ok' && (
        <>
          <p className="subtle">
            {state.validators.length} validator{state.validators.length === 1 ? '' : 's'}{' '}
            (shape: <code>{state.rawShape}</code>)
          </p>
          {state.validators.length === 0 ? (
            <p className="subtle">
              No validators returned. The node may be single-validator and expose them
              differently, or this endpoint reports only non-genesis validators.
            </p>
          ) : (
            <table className="subgrove-table">
              <thead>
                <tr>
                  <th>DID</th>
                  <th>Total stake</th>
                  <th>Self stake</th>
                  <th>Active</th>
                  <th>Jailed</th>
                </tr>
              </thead>
              <tbody>
                {state.validators.map((v, i) => {
                  const fmt = (n: number | string | undefined) => {
                    if (n === undefined) return '—';
                    const will = Math.round(Number(n) / 1e18);
                    return `${will.toLocaleString()} WILL`;
                  };
                  return (
                    <tr key={`${v.did ?? i}`}>
                      <td>
                        <code>{v.did ?? '—'}</code>
                      </td>
                      <td>{fmt(v.total_stake)}</td>
                      <td>{fmt(v.self_stake)}</td>
                      <td>{v.active ? '✓' : '—'}</td>
                      <td>{v.jailed ? 'yes' : 'no'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
