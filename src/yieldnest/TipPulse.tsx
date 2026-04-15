import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "./graphql";

const POLL_MS = 3000;
const RPC = (import.meta as any).env?.VITE_ETH_RPC ?? "/eth-rpc";

async function latestIndexedBlock(subgrove: string): Promise<number> {
  try {
    const d = await runQuery<any>(
      subgrove,
      `{ deposits(first: 1, orderBy: blockNumber, orderDirection: desc) { blockNumber }
         transfers(first: 1, orderBy: blockNumber, orderDirection: desc) { blockNumber } }`,
    );
    const arr = [...(d.deposits ?? []), ...(d.transfers ?? [])];
    return arr.reduce((m, x) => Math.max(m, Number(x.blockNumber ?? 0)), 0);
  } catch (e) {
    if (e instanceof NoIndexingProgressError) return 0;
    throw e;
  }
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
 *  every ~12s. Local indexed tip (latest deposit/transfer) advances only
 *  when YieldNest contracts actually emit — which is bursty. */
export function TipPulse({ subgrove = "yieldnest-vaults-eth" }: { subgrove?: string }) {
  const [tip, setTip] = useState<number | null>(null);
  const [indexed, setIndexed] = useState<number | null>(null);
  const [beatKey, setBeatKey] = useState(0);
  const [tipAge, setTipAge] = useState(0);

  useEffect(() => {
    let alive = true;
    let lastTip = 0;
    const tick = async () => {
      try {
        const [t, i] = await Promise.all([chainTip(), latestIndexedBlock(subgrove)]);
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
  }, [subgrove]);

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
              tip {tip.toLocaleString()}
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
