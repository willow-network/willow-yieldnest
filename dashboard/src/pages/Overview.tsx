import { useEffect, useState } from "react";
import { useSubgroves } from "../yieldnest/useSubgroves";
import { nodeUrl } from "../yieldnest/api";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import { SubgroveShareChart } from "../yieldnest/charts";
import { LiveFeed } from "../yieldnest/LiveFeed";
import { TipPulse } from "../yieldnest/TipPulse";

const SUBGROVE_IDS = [
  "yieldnest-vaults-eth",
  "yieldnest-vaults-bnb",
  "yieldnest-vaults-l2",
  "yieldnest-restaking-eth",
  "yieldnest-liquidity",
  "yieldnest-governance",
];

const SUBGROVE_QUERIES: Record<string, string> = {
  "yieldnest-vaults-eth": `{ deposits(first:1000){id} transfers(first:1000){id} }`,
  "yieldnest-vaults-bnb": `{ deposits(first:1000){id} transfers(first:1000){id} }`,
  "yieldnest-vaults-l2":  `{ deposits(first:1000){id} transfers(first:1000){id} }`,
  "yieldnest-restaking-eth": `{ totalETHStakedUpdateds(first:1000){id} rewardsProcesseds(first:1000){id} ethWithdrawns(first:1000){id} }`,
  "yieldnest-liquidity": `{ swaps(first:1000){id} mints(first:1000){id} burns(first:1000){id} }`,
  "yieldnest-governance": `{ transfers(first:1000){id} }`,
};

function useCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const entries = await Promise.all(SUBGROVE_IDS.map(async sg => {
        try {
          const query = SUBGROVE_QUERIES[sg] ?? `{ deposits(first:1000){id} transfers(first:1000){id} }`;
          const d = await runQuery<any>(sg, query);
          const n = Object.values(d).reduce((sum: number, arr: any) =>
            sum + (Array.isArray(arr) ? arr.length : 0), 0);
          return [sg, n] as const;
        } catch (e) {
          if (!(e instanceof NoIndexingProgressError)) console.warn(`counts(${sg})`, e);
          return [sg, 0] as const;
        }
      }));
      if (!alive) return;
      setCounts(Object.fromEntries(entries));
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return counts;
}

export function Overview() {
  const s = useSubgroves();
  const counts = useCounts();
  const slices = SUBGROVE_IDS.map(id => ({ name: id.replace("yieldnest-", ""), value: counts[id] ?? 0 })).filter(s => s.value > 0);
  const totalEntities = slices.reduce((n, x) => n + x.value, 0);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0 }}>Overview</h1>
        <TipPulse />
      </div>
      <p className="yn-placeholder">
        YieldNest subgroves registered on the Willow network. Every panel here queries them
        with cryptographic proofs attached.
      </p>

      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card">
          <h3>Node status</h3>
          <div className="big">{s.status === "loading" ? "…" : s.status === "ok" ? "online" : "offline"}</div>
          <div className="sub">{s.status === "error" ? s.message : nodeUrl()}</div>
        </div>
        <div className="yn-card">
          <h3>Total entities indexed</h3>
          <div className="big">{totalEntities.toLocaleString()}</div>
          <div className="sub">across all subgroves</div>
        </div>
        <div className="yn-card">
          <h3>Indexing window</h3>
          <div className="big">~100k blocks</div>
          <div className="sub">from block 24,790,000 to chain tip</div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Registered subgroves</h3>
          <div className="sub" style={{ marginBottom: 12 }}>indexing jobs on the Willow network</div>
          <table className="yn-table" style={{ fontSize: 13 }}>
            <thead><tr><th>Subgrove</th><th>Entities</th><th>Status</th></tr></thead>
            <tbody>
              {SUBGROVE_IDS.map(id => {
                const c = counts[id] ?? 0;
                return (
                  <tr key={id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{id.replace("yieldnest-", "")}</td>
                    <td>{c.toLocaleString()}</td>
                    <td style={{ color: c > 0 ? "var(--yn-success)" : "var(--yn-text-dim)" }}>
                      {c > 0 ? "live" : "pending"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="yn-card">
          <h3>Entity share by subgrove</h3>
          <div className="sub" style={{ marginBottom: 12 }}>how activity is distributed across YieldNest's six subgroves</div>
          <SubgroveShareChart slices={slices} />
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
        <LiveFeed subgrove="yieldnest-vaults-eth" />
      </div>

    </section>
  );
}
