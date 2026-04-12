import { useEffect, useState } from 'react';

interface Props {
  apiUrl: string;
  onSubgroveClick?: (subgroveId: string) => void;
}

interface Subgrove {
  subgrove_id?: string;
  id?: string;
  name?: string;
  owner_did?: string;
  [k: string]: unknown;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; subgroves: Subgrove[] }
  | { kind: 'error'; message: string };

export function SubgrovesPanel({ apiUrl, onSubgroveClick }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState({ kind: 'loading' });
      try {
        const res = await fetch(`${apiUrl}/subgroves`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        // Accept either { data: [...] }, { subgroves: [...] }, or a raw array.
        const raw = body?.data ?? body?.subgroves ?? body;
        const subgroves: Subgrove[] = Array.isArray(raw) ? raw : [];
        setState({ kind: 'ok', subgroves });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <section className="panel">
      <h2>Subgroves</h2>
      <p className="panel-description">
        All subgroves registered on this Willow node. This panel hits{' '}
        <code>GET /subgroves</code> directly — no cryptographic proof is attached by the API
        for list-style endpoints, so the list itself is trusted to the server. The data inside
        each subgrove is what gets verified in the Data panel.
      </p>

      {state.kind === 'loading' && <p>Loading…</p>}

      {state.kind === 'error' && (
        <div className="result">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}

      {state.kind === 'ok' && (
        <>
          <p className="subtle">
            {state.subgroves.length} subgrove{state.subgroves.length === 1 ? '' : 's'}
          </p>
          {state.subgroves.length === 0 ? (
            <p className="subtle">No subgroves registered on this node yet.</p>
          ) : (
            <table className="subgrove-table">
              <thead>
                <tr>
                  <th>id</th>
                  <th>name</th>
                  <th>owner</th>
                </tr>
              </thead>
              <tbody>
                {state.subgroves.map((s, i) => {
                  const id = s.subgrove_id ?? s.id ?? '(unknown)';
                  const name = typeof s.name === 'string' ? s.name : '—';
                  const owner = typeof s.owner_did === 'string' ? s.owner_did : '—';
                  const clickable = !!onSubgroveClick && id !== '(unknown)';
                  return (
                    <tr
                      key={`${id}-${i}`}
                      className={clickable ? 'subgrove-row-clickable' : undefined}
                      onClick={clickable ? () => onSubgroveClick?.(id) : undefined}
                      data-testid={`subgrove-row-${id}`}
                    >
                      <td>
                        <code>{id}</code>
                      </td>
                      <td>{name}</td>
                      <td>
                        <code>{owner}</code>
                      </td>
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
