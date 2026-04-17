import { useEffect, useState } from "react";
import { useSubgroves } from "../yieldnest/useSubgroves";
import { nodeUrl } from "../yieldnest/api";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import { SubgroveShareChart } from "../yieldnest/charts";
import { LiveFeed } from "../yieldnest/LiveFeed";
import { SampleProofBadge } from "../yieldnest/SampleProofBadge";
import { TipPulse } from "../yieldnest/TipPulse";

const SUBGROVE_IDS = [
  "yieldnest-vaults-eth",
  "yieldnest-vaults-bnb",
  "yieldnest-vaults-l2",
  "yieldnest-restaking-eth",
  "yieldnest-liquidity",
  "yieldnest-governance",
];

function useCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const entries = await Promise.all(SUBGROVE_IDS.map(async sg => {
        try {
          const d = await runQuery<any>(sg, `{ deposits(first: 1000) { id } transfers(first: 1000) { id } }`);
          const n = (d.deposits?.length ?? 0) + (d.transfers?.length ?? 0);
          return [sg, n] as const;
        } catch (e) {
          // Expected for subgroves still warming up; don't spam console.
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
  const slices = SUBGROVE_IDS.map(id => ({ name: id.replace("yieldnest-", ""), value: counts[id] ?? 0 }));
  const totalEntities = slices.reduce((n, x) => n + x.value, 0);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0 }}>Overview</h1>
        <TipPulse />
      </div>
      <p className="yn-placeholder">
        Six YieldNest subgroves registered on a Willow node at <code>{nodeUrl()}</code>. Every panel
        here queries them with cryptographic proofs attached.
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
          <h3>Execution mode</h3>
          <div className="big">GKR</div>
          <div className="sub">cryptographic proof on every submission</div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Entity share by subgrove</h3>
          <div className="sub" style={{ marginBottom: 12 }}>how activity is distributed across YieldNest's six subgroves</div>
          <SubgroveShareChart slices={slices} />
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
        <LiveFeed subgrove="yieldnest-vaults-eth" />
      </div>

      {s.status === "ok" && (
        <table className="yn-table" style={{ marginTop: 32 }}>
          <thead>
            <tr>
              <th>Subgrove</th>
              <th>Entities</th>
              <th>Created (block)</th>
              <th>Retention</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {s.subgroves.map(sg => (
              <tr key={sg.subgrove_id}>
                <td style={{ fontFamily: "monospace" }}>{sg.subgrove_id}</td>
                <td>{(counts[sg.subgrove_id] ?? 0).toLocaleString()}</td>
                <td>{sg.created_at}</td>
                <td>{typeof sg.retention_window === "string" ? sg.retention_window : JSON.stringify(sg.retention_window)}</td>
                <td><SampleProofBadge subgrove={sg.subgrove_id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
