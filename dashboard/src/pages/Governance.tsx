import { SubgroveStatus } from "../yieldnest/SubgroveStatus";
import { ProofBadge } from "../yieldnest/ProofBadge";
import { CopyAddress } from "../yieldnest/CopyAddress";
import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import { getGkrState, type GkrState } from "../yieldnest/api";
import { PageSizeSelector, DEFAULT_PAGE_SIZE, type PageSize } from "../yieldnest/PageSize";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";

type Transfer = {
  id: string; from: string; to: string; value: string; blockNumber: string;
};

type State =
  | { status: "loading" }
  | { status: "ok"; transfers: Transfer[] }
  | { status: "error"; message: string };

const ZERO = "0x0000000000000000000000000000000000000000";
const tooltipStyle = {
  background: "var(--yn-surface)",
  border: "1px solid var(--yn-border)",
  borderRadius: 8,
  color: "var(--yn-text)",
  fontSize: 12,
};

function useGkrVotingPower(): { data: GkrState | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<GkrState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await getGkrState("yieldnest-governance");
        if (!alive) return;
        setData(s);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { data, loading, error };
}

function useGovernanceTransfers(pageSize: PageSize): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setS({ status: "loading" });
    const tick = async () => {
      try {
        const d = await runQuery<{ transfers: Transfer[] }>(
          "yieldnest-governance",
          `{ transfers(first: ${pageSize}) { id from to value blockNumber } }`,
        );
        if (!alive) return;
        setS({ status: "ok", transfers: d.transfers ?? [] });
      } catch (e) {
        if (!alive) return;
        if (e instanceof NoIndexingProgressError) setS({ status: "ok", transfers: [] });
        else setS({ status: "error", message: String(e) });
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); };
  }, [pageSize]);
  return s;
}

function weiToYnd(s: string): number {
  try { return Number(BigInt(s)) / 1e18; } catch { return 0; }
}

function short(addr: string) {
  if (!addr) return "—";
  if (addr.toLowerCase() === ZERO) return "mint/burn";
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

function VerifiedVotingPowerCard({
  state,
  loading,
  error,
}: {
  state: GkrState | null;
  loading: boolean;
  error: string | null;
}) {
  const positive = (state?.balances ?? []).filter((b) => {
    try {
      return BigInt(b.balance) > 0n;
    } catch {
      return false;
    }
  });
  const total = positive.reduce((acc, b) => acc + Number(BigInt(b.balance)) / 1e18, 0);
  const top = [...positive]
    .sort((a, b) => {
      try {
        const diff = BigInt(b.balance) - BigInt(a.balance);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      } catch {
        return 0;
      }
    })
    .slice(0, 10);

  return (
    <div className="yn-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Voting power</h3>
        <span
          className="yn-proof-badge"
          title="Every block's balances are anchored by a cryptographic proof that Willow validators verify, with each block's state pinned to the previous block's committed state."
        >
          Willow verified
        </span>
      </div>
      <div className="sub" style={{ marginTop: 8 }}>
        per-address YND balances across tracked governance addresses ·{" "}
        {state ? `at block ${state.last_block.toLocaleString()}` : "awaiting first verified block"}
      </div>

      {loading && !state && <p className="yn-placeholder" style={{ marginTop: 12 }}>loading…</p>}
      {error && <p className="yn-placeholder" style={{ marginTop: 12, color: "#c96" }}>error: {error}</p>}

      {state && positive.length === 0 && (
        <p className="yn-placeholder" style={{ marginTop: 12 }}>
          No tracked addresses with non-zero balance yet at block {state.last_block.toLocaleString()}.
        </p>
      )}

      {state && positive.length > 0 && (
        <>
          <div
            className="yn-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 16 }}
          >
            <div>
              <div className="big">{positive.length}</div>
              <div className="sub">holders with positive balance</div>
            </div>
            <div>
              <div className="big">{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="sub">YND summed across tracked addresses</div>
            </div>
          </div>

          <table className="yn-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Address</th>
                <th style={{ textAlign: "right" }}>YND</th>
              </tr>
            </thead>
            <tbody>
              {top.map((b) => {
                const ynd = Number(BigInt(b.balance)) / 1e18;
                return (
                  <tr key={b.address}>
                    <td><CopyAddress addr={b.address} /></td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {ynd.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function Governance() {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const s = useGovernanceTransfers(pageSize);
  const gkr = useGkrVotingPower();
  const xfers = s.status === "ok" ? s.transfers : [];

  // Net balance per address (accounts for mint/burn via the zero address).
  const balances = new Map<string, number>();
  let mintedOutOfZero = 0;
  let burnedIntoZero = 0;
  for (const t of xfers) {
    const v = weiToYnd(t.value);
    balances.set(t.from, (balances.get(t.from) ?? 0) - v);
    balances.set(t.to,   (balances.get(t.to)   ?? 0) + v);
    if (t.from.toLowerCase() === ZERO) mintedOutOfZero += v;
    if (t.to.toLowerCase()   === ZERO) burnedIntoZero  += v;
  }
  balances.delete(ZERO);

  const holdersWithPositiveBalance = [...balances.entries()]
    .filter(([, v]) => v > 0.0001)
    .sort((a, b) => b[1] - a[1]);
  const topHolders = holdersWithPositiveBalance.slice(0, 8).map(([addr, balance]) => ({
    addr,
    short: short(addr),
    balance: Number(balance.toFixed(2)),
  }));
  const totalVolume = xfers.reduce((n, t) => n + weiToYnd(t.value), 0);
  const latestBlock = xfers.reduce((m, t) => Math.max(m, Number(t.blockNumber)), 0);

  // Cumulative transfer volume over block height.
  const sorted = [...xfers].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
  let cum = 0;
  const cumData = sorted.map(t => {
    cum += weiToYnd(t.value);
    return { block: Number(t.blockNumber), cumulative: Number(cum.toFixed(2)) };
  });

  const recent = [...xfers]
    .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
    .slice(0, 10);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0 }}>Governance</h1>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>
      <p><SubgroveStatus id="yieldnest-governance" /></p>
      <p className="yn-placeholder">
        YND governance token activity — decoded by Willow from Ethereum mainnet transfer logs
        and (when available) delegation events.
      </p>

      <VerifiedVotingPowerCard state={gkr.data} loading={gkr.loading} error={gkr.error} />

      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card">
          <h3>Transfer events</h3>
          <div className="big">{xfers.length.toLocaleString()}</div>
          <div className="sub">from yieldnest-governance</div>
        </div>
        <div className="yn-card">
          <h3>Volume moved</h3>
          <div className="big">{totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="sub">YND summed across transfers</div>
        </div>
        <div className="yn-card">
          <h3>Holders with positive flow</h3>
          <div className="big">{holdersWithPositiveBalance.length}</div>
          <div className="sub">net &gt; 0 YND across indexed blocks</div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Cumulative transfer volume</h3>
          <div className="sub" style={{ marginBottom: 12 }}>summed YND value transferred, by block</div>
          {cumData.length === 0 ? (
            <p className="yn-placeholder">no transfers indexed yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cumData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
                       tickFormatter={(v) => v.toLocaleString()} />
                <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle}
                         labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="cumulative" stroke="#4ea882" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>

        <div className="yn-card">
          <h3>Top YND holders</h3>
          <div className="sub" style={{ marginBottom: 12 }}>net inflow (received − sent) across indexed blocks</div>
          {topHolders.length === 0 ? (
            <p className="yn-placeholder">no holder data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topHolders} layout="vertical"
                        margin={{ top: 10, right: 20, left: 90, bottom: 0 }}>
                <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="var(--yn-text-dim)" fontSize={11} />
                <YAxis type="category" dataKey="short" stroke="var(--yn-text-dim)"
                       fontSize={11} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="balance" fill="#2c7a5c" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <h2 style={{ marginTop: 32, fontSize: 18 }}>Latest transfers · block ≤ {latestBlock.toLocaleString()}</h2>
          <table className="yn-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Block</th>
                <th>From</th>
                <th>To</th>
                <th>YND</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(t => (
                <tr key={t.id}>
                  <td>{t.blockNumber}</td>
                  <td><CopyAddress addr={t.from} /></td>
                  <td><CopyAddress addr={t.to} /></td>
                  <td>{weiToYnd(t.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td><ProofBadge subgrove="yieldnest-governance" entityType="transfer" entityId={t.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
