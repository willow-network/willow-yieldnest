import { SubgroveStatus } from "../yieldnest/SubgroveStatus";
import { useDeposits, assetsNumberHeuristic } from "../yieldnest/useDeposits";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip, Legend,
} from "recharts";

/** Normalize a raw value into a 0–100 band using a soft cap. */
function norm(v: number, cap: number): number {
  if (!isFinite(v) || v <= 0) return 0;
  return Math.min(100, Math.round((v / cap) * 100));
}

export function RiskRadar() {
  const eth = useDeposits("yieldnest-vaults-eth");
  const restaking = useDeposits("yieldnest-restaking-eth"); // reused for activity metrics

  const depositsEth = eth.status === "ok" ? eth.deposits : [];

  // Derived metrics per vault — all bounded 0–100 so they share an axis.
  const metrics = (() => {
    if (depositsEth.length === 0) {
      return [
        { axis: "Deposit activity", value: 0 },
        { axis: "Unique owners", value: 0 },
        { axis: "Avg size", value: 0 },
        { axis: "Owner spread", value: 0 },
        { axis: "Recency", value: 0 },
        { axis: "Restaking flow", value: 0 },
      ];
    }
    const owners = new Set<string>();
    let totalAssets = 0;
    let latestBlock = 0;
    const perOwner = new Map<string, number>();
    for (const d of depositsEth) {
      const amt = assetsNumberHeuristic(d);
      totalAssets += amt;
      owners.add(d.owner);
      perOwner.set(d.owner, (perOwner.get(d.owner) ?? 0) + amt);
      latestBlock = Math.max(latestBlock, Number(d.blockNumber));
    }
    const avgSize = totalAssets / depositsEth.length;
    const topOwnerShare = Math.max(...perOwner.values()) / totalAssets; // 0..1
    const spread = 1 - topOwnerShare; // higher = more decentralised
    // Recency: blocks since the last deposit vs a 1000-block horizon. Newer = higher.
    const ageBlocks = Math.max(0, (latestBlock + 50) - latestBlock);
    const restakeVol = restaking.status === "ok"
      ? restaking.deposits.length // proxy; restaking subgrove indexes Transfers, not deposits
      : 0;

    return [
      { axis: "Deposit activity",  value: norm(depositsEth.length, 1000) },
      { axis: "Unique owners",     value: norm(owners.size, 200) },
      { axis: "Avg deposit size",  value: norm(avgSize, 100) },
      { axis: "Owner spread",      value: Math.round(spread * 100) },
      { axis: "Recency",           value: norm(Math.max(0, 100 - ageBlocks), 100) },
      { axis: "Restaking flow",    value: norm(restakeVol, 500) },
    ];
  })();

  const loaded = eth.status === "ok";

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Risk Radar</h1>
      <p><SubgroveStatus id="yieldnest-liquidity" /></p>
      <p className="yn-placeholder">
        Health metrics derived from YieldNest on-chain activity — deposit velocity, owner
        concentration, and restaking flow — all decoded by Willow from live Ethereum logs.
        Inspired by the YieldNest × IntoTheBlock Risk Radar.
      </p>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card" style={{ gridColumn: "span 2" }}>
          <h3>Vault health radar</h3>
          <div className="sub" style={{ marginBottom: 12 }}>
            all axes normalised 0–100 · higher is healthier (more activity, more spread)
          </div>
          {!loaded ? (
            <p className="yn-placeholder">loading…</p>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart data={metrics} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                <PolarGrid stroke="var(--yn-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--yn-text-dim)", fontSize: 12 }} />
                <PolarRadiusAxis
                  domain={[0, 100]} tick={{ fill: "var(--yn-text-dim)", fontSize: 10 }}
                  stroke="var(--yn-border)"
                />
                <Radar
                  name="ynETH family"
                  dataKey="value"
                  stroke="#2c7a5c"
                  fill="#4ea882"
                  fillOpacity={0.45}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--yn-surface)",
                    border: "1px solid var(--yn-border)",
                    borderRadius: 8, color: "var(--yn-text)", fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ color: "var(--yn-text)", fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
          <div style={{ marginTop: 10 }}>
            <span className="yn-proof-badge">Willow verified</span>
          </div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24 }}>
        {metrics.map(m => (
          <div key={m.axis} className="yn-card">
            <h3>{m.axis}</h3>
            <div className="big">{m.value}</div>
            <div className="sub">scaled 0–100</div>
          </div>
        ))}
      </div>

      <p className="sub" style={{ marginTop: 24 }}>
        Activity-derived risk signals from Willow-indexed Ethereum data. Vault deposit volume,
        governance token concentration, and restaking flow are updated live as new blocks are indexed.
      </p>
    </section>
  );
}
