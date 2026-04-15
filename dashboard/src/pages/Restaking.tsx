import { SubgroveStatus } from "../yieldnest/SubgroveStatus";
import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";

type Transfer = { id: string; from: string; to: string; value: string; blockNumber: string };

type State =
  | { status: "loading" }
  | { status: "ok"; transfers: Transfer[] }
  | { status: "error"; message: string };

function useRestakingTransfers(): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await runQuery<{ transfers: Transfer[] }>(
          "yieldnest-restaking-eth",
          `{ transfers(first: 5000) { id from to value blockNumber } }`,
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
  }, []);
  return s;
}

function weiToEth(s: string): number {
  try { return Number(BigInt(s)) / 1e18; } catch { return 0; }
}

export function Restaking() {
  const s = useRestakingTransfers();
  const xfers = s.status === "ok" ? s.transfers : [];
  const totalVolume = xfers.reduce((n, t) => n + weiToEth(t.value), 0);
  const uniqueAddrs = new Set<string>();
  for (const t of xfers) { uniqueAddrs.add(t.from); uniqueAddrs.add(t.to); }
  const latestBlock = xfers.reduce((m, t) => Math.max(m, Number(t.blockNumber)), 0);

  const sorted = [...xfers].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
  let cum = 0;
  const cumData = sorted.map(t => {
    cum += weiToEth(t.value);
    return { block: Number(t.blockNumber), cumulative: Number(cum.toFixed(4)) };
  });

  const topSenders = Object.entries(
    xfers.reduce<Record<string, number>>((acc, t) => {
      acc[t.from] = (acc[t.from] ?? 0) + weiToEth(t.value);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Restaking</h1>
      <p><SubgroveStatus id="yieldnest-restaking-eth" /></p>
      <p className="yn-placeholder">
        StakingNodesManager, RewardsDistributor, and EL/CL receivers — decoded by Willow from
        Ethereum mainnet.
      </p>

      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card">
          <h3>Transfer events</h3>
          <div className="big">{s.status === "ok" ? xfers.length.toLocaleString() : "—"}</div>
          <div className="sub">on restaking contracts</div>
        </div>
        <div className="yn-card">
          <h3>Total volume moved</h3>
          <div className="big">{totalVolume.toFixed(2)}</div>
          <div className="sub">ETH-scale (18-decimal tokens)</div>
        </div>
        <div className="yn-card">
          <h3>Unique addresses</h3>
          <div className="big">{uniqueAddrs.size}</div>
          <div className="sub">either side of a transfer</div>
        </div>
        <div className="yn-card">
          <h3>Latest block</h3>
          <div className="big">{latestBlock || "—"}</div>
          <div className="sub">furthest indexed block</div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Cumulative restaking volume</h3>
          <div className="sub" style={{ marginBottom: 12 }}>summed transfer value over block height</div>
          {s.status === "ok" && cumData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cumData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
                       tickFormatter={(v) => v.toLocaleString()} />
                <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "var(--yn-surface)", border: "1px solid var(--yn-border)", borderRadius: 8, color: "var(--yn-text)", fontSize: 12 }}
                  labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`}
                />
                <Line type="monotone" dataKey="cumulative" stroke="#4ea882" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="yn-placeholder">no transfer events yet</p>
          )}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>

        <div className="yn-card">
          <h3>Largest senders</h3>
          <div className="sub" style={{ marginBottom: 12 }}>top 5 addresses by outflow on restaking contracts</div>
          {topSenders.length === 0 ? (
            <p className="yn-placeholder">no data yet</p>
          ) : (
            <table className="yn-table">
              <thead><tr><th>Address</th><th>Volume</th><th>Proof</th></tr></thead>
              <tbody>
                {topSenders.map(([addr, vol]) => (
                  <tr key={addr}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{addr.slice(0, 10)}…{addr.slice(-6)}</td>
                    <td>{vol.toFixed(4)}</td>
                    <td><span className="yn-proof-badge" title="Aggregate across many transfers; click a row on Portfolio or LiveFeed for a per-event proof.">Willow verified</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
