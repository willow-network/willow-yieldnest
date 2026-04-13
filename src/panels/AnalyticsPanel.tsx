import { extractErrorMessage } from '../lib/errors';
import { useState } from 'react';
import { getClient } from '../lib/client';
import { ExamplesDropdown, Example } from '../components/ExamplesDropdown';

interface Props {
  apiUrl: string;
}

interface SchemaEntity {
  name: string;
  fields: string[];
}

type ChartType = 'bar' | 'line';

type PanelState =
  | { kind: 'idle' }
  | { kind: 'loading'; step: string }
  | {
      kind: 'ok';
      entity: string;
      metric: string;
      groupBy: string;
      data: Record<string, unknown>[];
      chartType: ChartType;
      decimals: number;
    }
  | { kind: 'error'; message: string };

function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 10000) return Math.round(n).toLocaleString();
  if (abs >= 1) return n.toFixed(1);
  if (abs > 0) return n.toFixed(4);
  return '0';
}

function shortenAddress(addr: string): string {
  if (addr.length > 12 && addr.startsWith('0x')) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr;
}

function getNumeric(item: Record<string, unknown>, key: string): number | null {
  const v = item[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 0.001);
  const barWidth = Math.max(20, Math.min(60, 500 / data.length));
  const svgWidth = data.length * (barWidth + 8) + 40;
  const svgHeight = 220;
  const chartHeight = 180;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const x = 30 + i * (barWidth + 8);
          const h = (d.value / max) * chartHeight;
          return (
            <g key={i}>
              <rect
                x={x}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                fill={color}
                rx={3}
              />
              <title>{`${d.label}: ${formatNumber(d.value)}`}</title>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 14}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-muted)"
              >
                {d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}
              </text>
            </g>
          );
        })}
        {/* Y-axis labels */}
        <text x={0} y={12} fontSize={10} fill="var(--text-muted)">
          {formatNumber(max)}
        </text>
        <text x={0} y={chartHeight} fontSize={10} fill="var(--text-muted)">
          0
        </text>
      </svg>
    </div>
  );
}

function LineChart({ points, color }: { points: [number, number][]; color: string }) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const svgWidth = 600;
  const svgHeight = 220;
  const pad = 40;
  const w = svgWidth - pad * 2;
  const h = svgHeight - pad * 2;

  const scaled = points.map(([x, y]) => [
    pad + ((x - minX) / rangeX) * w,
    pad + h - ((y - minY) / rangeY) * h,
  ]);
  const pathD = scaled.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  return (
    <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
      {scaled.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={color}>
          <title>{`${formatNumber(points[i][0])}: ${formatNumber(points[i][1])}`}</title>
        </circle>
      ))}
      <text x={pad} y={pad - 8} fontSize={10} fill="var(--text-muted)">
        {formatNumber(maxY)}
      </text>
      <text x={pad} y={pad + h + 14} fontSize={10} fill="var(--text-muted)">
        {formatNumber(minY)}
      </text>
      <text x={pad} y={pad + h + 14} fontSize={10} fill="var(--text-muted)" textAnchor="start">
        {formatNumber(minX)}
      </text>
      <text x={pad + w} y={pad + h + 14} fontSize={10} fill="var(--text-muted)" textAnchor="end">
        {formatNumber(maxX)}
      </text>
    </svg>
  );
}

export function AnalyticsPanel({ apiUrl }: Props) {
  const [subgroveId, setSubgroveId] = useState('');
  const [schema, setSchema] = useState<SchemaEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState(0);
  const [groupBy, setGroupBy] = useState('');
  const [decimals, setDecimals] = useState(0);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const [schemaLoading, setSchemaLoading] = useState(false);

  const loadSchema = async () => {
    if (!subgroveId) return;
    setSchemaLoading(true);
    try {
      const client = getClient(apiUrl);
      const headers = client.auth.getAuthHeaders('POST', `/graphql/${subgroveId}`);
      const res = await fetch(`${apiUrl}/graphql/${subgroveId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '{ __schema { types { name kind fields { name type { name kind ofType { name kind } } } } } }',
        }),
      });
      const body = await res.json();
      const data = body?.data?.data ?? body?.data;
      const types = data?.__schema?.types ?? [];
      const entities: SchemaEntity[] = types
        .filter(
          (t: any) =>
            t.kind === 'OBJECT' &&
            !t.name.startsWith('__') &&
            t.name !== 'Query' &&
            t.name !== 'Subscription' &&
            t.fields?.length > 0,
        )
        .map((t: any) => ({
          name: t.name,
          fields: t.fields.map((f: any) => f.name).filter((n: string) => n !== 'id'),
        }));
      setSchema(entities);
      setSelectedEntity(0);
      if (entities.length > 0) {
        const defaultMetric = entities[0].fields.findIndex((f: string) =>
          ['tick', 'amount', 'value', 'cost', 'balance', 'price', 'total', 'count'].includes(f),
        );
        setSelectedMetric(defaultMetric >= 0 ? defaultMetric : 0);
      }
    } catch (err) {
      setState({ kind: 'error', message: `Schema load failed: ${extractErrorMessage(err)}` });
    } finally {
      setSchemaLoading(false);
    }
  };

  const fetchData = async () => {
    if (schema.length === 0) return;
    const entity = schema[selectedEntity];
    if (!entity) return;
    const metric = entity.fields[selectedMetric] ?? entity.fields[0];

    setState({ kind: 'loading', step: 'Fetching data via GraphQL…' });
    try {
      const client = getClient(apiUrl);
      const headers = client.auth.getAuthHeaders('POST', `/graphql/${subgroveId}`);
      const plural = entity.name[0].toLowerCase() + entity.name.slice(1) + 's';
      const fields = [metric, 'blockNumber'];
      if (groupBy && !fields.includes(groupBy)) fields.push(groupBy);

      const query = `{ ${plural}(first: 500, orderBy: blockNumber, orderDirection: desc) { ${fields.join(' ')} } }`;
      const res = await fetch(`${apiUrl}/graphql/${subgroveId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const body = await res.json();
      const data = body?.data?.data?.[plural] ?? body?.data?.[plural] ?? [];

      setState({
        kind: 'ok',
        entity: entity.name,
        metric,
        groupBy,
        data,
        chartType,
        decimals,
      });
    } catch (err) {
      setState({ kind: 'error', message: extractErrorMessage(err) });
    }
  };

  const currentEntity = schema[selectedEntity];
  const currentFields = currentEntity?.fields ?? [];

  return (
    <section className="panel">
      <h2>Analytics</h2>
      <p className="panel-description">
        Query indexed blockchain data via GraphQL, visualize metrics as bar or line charts, and
        explore the underlying records. Select a subgrove, load its schema, then pick an entity
        and metric to chart.
      </p>

      <ExamplesDropdown
        examples={[
          {
            label: 'Load schema for "user-profiles"',
            description: 'Discover entities and fields via GraphQL introspection',
            apply: () => setSubgroveId('user-profiles'),
          },
        ] satisfies Example[]}
      />

      <div className="form-row">
        <label className="form-field">
          <span>subgrove id</span>
          <input
            value={subgroveId}
            onChange={(e) => setSubgroveId(e.target.value)}
            placeholder="my-subgrove"
            spellCheck={false}
          />
        </label>
        <button className="btn btn-primary" onClick={loadSchema} disabled={schemaLoading || !subgroveId}>
          {schemaLoading ? 'Loading…' : 'Load Schema'}
        </button>
      </div>

      {schema.length > 0 && (
        <>
          <div className="form-row">
            <label className="form-field" style={{ flex: '0 0 160px' }}>
              <span>entity</span>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(Number(e.target.value));
                  setSelectedMetric(0);
                }}
              >
                {schema.map((e, i) => (
                  <option key={i} value={i}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ flex: '0 0 140px' }}>
              <span>metric</span>
              <select value={selectedMetric} onChange={(e) => setSelectedMetric(Number(e.target.value))}>
                {currentFields.map((f, i) => (
                  <option key={i} value={i}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field" style={{ flex: '0 0 140px' }}>
              <span>group by</span>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="">(none)</option>
                {currentFields
                  .filter((f) => f !== currentFields[selectedMetric] && !['id', 'blockNumber', 'timestamp', 'transactionHash'].includes(f))
                  .map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-field" style={{ flex: '0 0 80px' }}>
              <span>decimals</span>
              <select value={decimals} onChange={(e) => setDecimals(Number(e.target.value))}>
                {[0, 6, 8, 18].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <button
              className={chartType === 'bar' ? 'btn btn-primary' : 'btn'}
              onClick={() => setChartType('bar')}
              style={{ padding: '0.35rem 0.7rem' }}
            >
              Bar
            </button>
            <button
              className={chartType === 'line' ? 'btn btn-primary' : 'btn'}
              onClick={() => setChartType('line')}
              style={{ padding: '0.35rem 0.7rem' }}
            >
              Line
            </button>
            <button
              className="btn btn-primary"
              onClick={fetchData}
              disabled={state.kind === 'loading'}
            >
              {state.kind === 'loading' ? state.step : 'Fetch & Chart'}
            </button>
          </div>
        </>
      )}

      {state.kind === 'error' && (
        <div className="result">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="result">
          <div className="result-header">
            <span className="badge badge-ok">
              {state.data.length} {state.entity} records
            </span>
            <div className="result-header-right">
              <span>
                {state.metric}
                {state.groupBy ? ` grouped by ${state.groupBy}` : ''}
              </span>
            </div>
          </div>
          <div className="result-body">
            {(() => {
              const divisor = state.decimals > 0 ? Math.pow(10, state.decimals) : 1;
              const metric = state.metric;

              if (state.chartType === 'bar') {
                const buckets = new Map<string, number>();
                if (state.groupBy) {
                  for (const item of state.data) {
                    const label = shortenAddress(String(item[state.groupBy] ?? '?'));
                    const val = (getNumeric(item, metric) ?? 0) / divisor;
                    buckets.set(label, (buckets.get(label) ?? 0) + val);
                  }
                } else {
                  state.data.forEach((item, i) => {
                    const val = (getNumeric(item, metric) ?? 0) / divisor;
                    buckets.set(`#${i}`, val);
                  });
                }
                const sorted = [...buckets.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
                  .map(([label, value]) => ({ label, value }));

                return <BarChart data={sorted} color="var(--accent)" />;
              }

              // Line chart
              const points: [number, number][] = state.data
                .map((item) => {
                  const x =
                    getNumeric(item, 'blockNumber') ??
                    getNumeric(item, 'timestamp') ??
                    0;
                  const y = (getNumeric(item, metric) ?? 0) / divisor;
                  return [x, y] as [number, number];
                })
                .filter(([, y]) => y !== 0)
                .sort((a, b) => a[0] - b[0]);

              return <LineChart points={points} color="var(--accent)" />;
            })()}

            <h3>Records</h3>
            {state.data.length > 0 && (
              <div style={{ overflowX: 'auto', maxHeight: 250 }}>
                <table className="subgrove-table">
                  <thead>
                    <tr>
                      {Object.keys(state.data[0])
                        .filter((k) => k !== 'id')
                        .slice(0, 6)
                        .map((k) => (
                          <th key={k}>{k}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.slice(0, 50).map((item, i) => (
                      <tr key={i}>
                        {Object.entries(item)
                          .filter(([k]) => k !== 'id')
                          .slice(0, 6)
                          .map(([k, v]) => (
                            <td key={k}>
                              <code>
                                {typeof v === 'string'
                                  ? shortenAddress(v)
                                  : typeof v === 'number'
                                    ? formatNumber(
                                        v / (state.decimals > 0 ? Math.pow(10, state.decimals) : 1),
                                      )
                                    : String(v)}
                              </code>
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
