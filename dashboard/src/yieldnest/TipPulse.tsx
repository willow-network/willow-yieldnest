import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "./graphql";

const POLL_MS = 10000;
const RPC = (import.meta as any).env?.VITE_ETH_RPC ?? "/eth-rpc";

// Per-subgrove "what counts as a yn-event" query — picks the block-bearing
// entities for each subgrove and asks for the single most-recent one. The
// caller takes the max across all of them. Limited to ETH-mainnet subgroves
// so the lag arithmetic (eth tip - indexed) lines up with the chain whose
// tip we're showing; bnb / l2 subgroves index different chains and can't
// be compared against an Ethereum block tip.
const YN_LAG_QUERIES: ReadonlyArray<readonly [string, string]> = [
  [
    "yieldnest-vaults-eth",
    `{ deposits(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       withdraws(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       transfers(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber } }`,
  ],
  [
    "yieldnest-restaking-eth",
    `{ totalETHStakedUpdateds(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       rewardsProcesseds(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       ethWithdrawns(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber } }`,
  ],
  [
    "yieldnest-liquidity",
    `{ swaps(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       mints(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       burns(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber } }`,
  ],
  [
    "yieldnest-governance",
    `{ transfers(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       delegateChangeds(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber }
       delegateVotesChangeds(first:1, orderBy:blockNumber, orderDirection:desc) { blockNumber } }`,
  ],
];

function maxBlockOf(d: any): number {
  if (!d || typeof d !== "object") return 0;
  let m = 0;
  for (const v of Object.values(d)) {
    if (Array.isArray(v)) {
      for (const e of v) {
        const b = Number((e as any)?.blockNumber ?? 0);
        if (b > m) m = b;
      }
    }
  }
  return m;
}

async function latestIndexedBlock(): Promise<number> {
  const results = await Promise.all(
    YN_LAG_QUERIES.map(async ([sg, q]) => {
      try {
        const d = await runQuery<any>(sg, q);
        return maxBlockOf(d);
      } catch (e) {
        if (e instanceof NoIndexingProgressError) return 0;
        return 0;
      }
    }),
  );
  return results.reduce((m, b) => Math.max(m, b), 0);
}

async function chainTip(): Promise<number> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  const body = await r.json();
  return parseInt(body.result ?? "0x0", 16);
}

/** Two-part heartbeat: chain tip (Alchemy eth_blockNumber) always advances
 *  every ~12s. Local indexed tip (latest event across all ETH-mainnet YN
 *  subgroves) advances only when YieldNest contracts actually emit — which
 *  is bursty. */
export function TipPulse() {
  const [tip, setTip] = useState<number | null>(null);
  const [indexed, setIndexed] = useState<number | null>(null);
  const [beatKey, setBeatKey] = useState(0);
  const [tipAge, setTipAge] = useState(0);

  useEffect(() => {
    let alive = true;
    let lastTip = 0;
    const tick = async () => {
      try {
        const [t, i] = await Promise.all([chainTip(), latestIndexedBlock()]);
        if (!alive) return;
        if (t > lastTip) {
          lastTip = t;
          setTip(t);
          setBeatKey(k => k + 1);
          setTipAge(0);
        }
        setIndexed(i);
      } catch { /* transient */ }
    };
    tick();
    const poll = setInterval(tick, POLL_MS);
    const ager = setInterval(() => setTipAge(a => a + 1), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(ager); };
  }, []);

  const lag = tip !== null && indexed !== null ? tip - indexed : null;
  const fresh = tipAge < 6;

  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 12,
        padding: "8px 14px",
        background: "var(--yn-surface)",
        border: "1px solid var(--yn-border)",
        borderRadius: 999,
        fontSize: 12,
        color: "var(--yn-text-dim)",
      }}
    >
      <span
        key={beatKey}
        className="yn-heartbeat"
        style={{
          width: 10, height: 10, borderRadius: "50%",
          background: fresh ? "var(--yn-accent)" : "var(--yn-text-dim)",
        }}
      />
      <span>
        {tip === null ? (
          "syncing tip…"
        ) : (
          <>
            <span style={{ color: "var(--yn-text)", fontFamily: "monospace" }}>
              eth tip {tip.toLocaleString()}
            </span>
            {indexed !== null && indexed > 0 && (
              <>
                {" · "}
                <span style={{ fontFamily: "monospace" }}>
                  last yn-event {indexed.toLocaleString()}
                </span>
                {lag !== null && (
                  <span
                    style={{ marginLeft: 6, color: lag < 1000 ? "var(--yn-accent)" : undefined }}
                    title={lag < 1000
                      ? "indexer is caught up; YieldNest contracts just haven't emitted lately"
                      : "no YieldNest activity in this many blocks"}
                  >
                    ({lag.toLocaleString()} blocks quiet)
                  </span>
                )}
              </>
            )}
          </>
        )}
      </span>
    </div>
  );
}
