import { useEffect, useState } from "react";
import { useSubgroves } from "../yieldnest/useSubgroves";
import { nodeUrl } from "../yieldnest/api";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import { SubgroveShareChart } from "../yieldnest/charts";
import { LiveFeed } from "../yieldnest/LiveFeed";
import { TipPulse } from "../yieldnest/TipPulse";
import { ProofLoader } from "../yieldnest/ProofLoader";

const SUBGROVE_IDS = [
  "yieldnest-vaults-eth",
  "yieldnest-restaking-eth",
  "yieldnest-liquidity",
  "yieldnest-governance",
];

const SUBGROVE_QUERIES: Record<string, string> = {
  "yieldnest-vaults-eth": `{ deposits(first:150){id} transfers(first:150){id} }`,
  "yieldnest-restaking-eth": `{ totalETHStakedUpdateds(first:150){id} rewardsProcesseds(first:150){id} ethWithdrawns(first:150){id} }`,
  "yieldnest-liquidity": `{ swaps(first:150){id} mints(first:150){id} burns(first:150){id} }`,
  "yieldnest-governance": `{ transfers(first:150){id} }`,
};

// "live" iff the indexer is making progress on the subgrove (event count
// can be 0 — that just means no matching events have been seen yet, not
// that the subgrove isn't running). "pending" is reserved for the case
// where the indexer hasn't reported any progress, which the GraphQL layer
// surfaces via `NoIndexingProgressError`.
type SubgroveStatus = { count: number; indexing: boolean };

// Each subgrove polls independently and renders as soon as its count lands —
// the indexer's tail latency (p99 in the tens of seconds) must not gate the
// whole panel on the slowest of four queries. Transient failures retry with
// backoff inside the tick and keep the last known count rather than flashing
// zeros; only NoIndexingProgressError marks a subgrove "pending". Early
// attempts fail fast to catch latency variance; the final attempt gets the
// full budget so a uniformly slow (but healthy) indexer still lands.
const COUNT_POLL_MS = 30000;
const COUNT_TIMEOUT_MS = 8000;
const COUNT_TIMEOUT_FINAL_MS = 25000;
const COUNT_RETRY_BASE_MS = 1500;
const COUNT_RETRIES = 2;

function useCounts() {
  const [counts, setCounts] = useState<Record<string, SubgroveStatus>>({});
  useEffect(() => {
    let alive = true;
    const cancels: Array<() => void> = [];

    SUBGROVE_IDS.forEach(sg => {
      const query = SUBGROVE_QUERIES[sg] ?? `{ deposits(first:150){id} transfers(first:150){id} }`;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let attempt = 0;
      const schedule = (ms: number) => { timer = setTimeout(run, ms); };
      const run = async () => {
        if (!alive) return;
        try {
          const timeoutMs = attempt < COUNT_RETRIES ? COUNT_TIMEOUT_MS : COUNT_TIMEOUT_FINAL_MS;
          const d = await runQuery<any>(sg, query, { timeoutMs });
          if (!alive) return;
          const n = Object.values(d).reduce((sum: number, arr: any) =>
            sum + (Array.isArray(arr) ? arr.length : 0), 0);
          setCounts(prev => ({ ...prev, [sg]: { count: n, indexing: true } }));
          attempt = 0;
          schedule(COUNT_POLL_MS);
        } catch (e) {
          if (!alive) return;
          if (e instanceof NoIndexingProgressError) {
            setCounts(prev => ({ ...prev, [sg]: { count: 0, indexing: false } }));
            attempt = 0;
            schedule(COUNT_POLL_MS);
            return;
          }
          console.warn(`counts(${sg})`, e);
          if (attempt < COUNT_RETRIES) {
            attempt += 1;
            schedule(COUNT_RETRY_BASE_MS * 2 ** (attempt - 1));
          } else {
            attempt = 0;
            schedule(COUNT_POLL_MS);
          }
        }
      };
      run();
      cancels.push(() => { if (timer !== undefined) clearTimeout(timer); });
    });

    return () => { alive = false; cancels.forEach(c => c()); };
  }, []);
  return counts;
}

export function Overview() {
  const s = useSubgroves();
  const counts = useCounts();
  const slices = SUBGROVE_IDS
    .map(id => ({ name: id.replace("yieldnest-", ""), value: counts[id]?.count ?? 0 }))
    .filter(s => s.value > 0);
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
          <div className="big">~5.5M blocks</div>
          <div className="sub">from block 19,800,000 to chain tip</div>
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
                const st = counts[id];
                const c = st?.count ?? 0;
                // "pending" only when the indexer has NOT made any progress
                // for this subgrove (NoIndexingProgressError). A subgrove
                // that's actively indexing but hasn't matched any events
                // yet (e.g. restaking-eth before its first RewardsProcessed)
                // is still "live" — the count column conveys "0 so far".
                const status = st === undefined ? "…" : st.indexing ? "live" : "pending";
                const live = status === "live";
                return (
                  <tr key={id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{id.replace("yieldnest-", "")}</td>
                    <td>{c.toLocaleString()}</td>
                    <td style={{ color: live ? "var(--yn-success)" : "var(--yn-text-dim)" }}>
                      {status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="yn-card">
          <h3>Entity share by subgrove</h3>
          <div className="sub" style={{ marginBottom: 12 }}>how activity is distributed across YieldNest's Ethereum subgroves</div>
          {Object.keys(counts).length === 0 ? <ProofLoader /> : <SubgroveShareChart slices={slices} />}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
        <LiveFeed subgrove="yieldnest-vaults-eth" />
      </div>

    </section>
  );
}
