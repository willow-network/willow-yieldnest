import { VAULTS } from "../yieldnest/config";
import { useSubgroves } from "../yieldnest/useSubgroves";
import { useDeposits, assetsNumberHeuristic } from "../yieldnest/useDeposits";
import { CumulativeTvlChart, DepositVolumeChart, TopDepositorsChart } from "../yieldnest/charts";
import { SampleProofBadge } from "../yieldnest/SampleProofBadge";
import { ProofLoader } from "../yieldnest/ProofLoader";
import { useVaultTvl, fmtUsd } from "../yieldnest/useVaultTvl";

export function Earn() {
  const s = useSubgroves();
  const eth = useDeposits("yieldnest-vaults-eth");
  const tvl = useVaultTvl();
  const registered = s.status === "ok" ? new Set(s.subgroves.map(x => x.subgrove_id)) : new Set<string>();

  const count = eth.status === "ok" ? eth.deposits.length : 0;
  const totalAssets = eth.status === "ok" ? eth.deposits.reduce((sum, d) => sum + assetsNumberHeuristic(d), 0) : 0;
  const latestBlock = eth.status === "ok"
    ? eth.deposits.reduce((m, d) => Math.max(m, Number(d.blockNumber ?? 0)), 0)
    : 0;

  const vaultUsd: Record<string, number> = {};
  const vaultAssets: Record<string, { amt: number; underlying: string }> = {};
  if (tvl.status === "ok") {
    for (const v of tvl.perVault) {
      vaultUsd[v.symbol] = v.usd;
      vaultAssets[v.symbol] = { amt: v.totalAssets, underlying: v.underlying };
    }
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Earn</h1>
      <p className="yn-placeholder">
        Per-vault activity — sourced from Willow subgroves. Every entity shown here was decoded by a
        Willow indexer from live Ethereum logs and persisted with cryptographic proofs.
      </p>

      <div className="yn-grid" style={{ marginBottom: 24 }}>
        <div className="yn-card">
          <h3>Deposits indexed</h3>
          <div className="big">{eth.status === "ok" ? count : eth.status === "loading" ? "…" : "—"}</div>
          <div className="sub">yieldnest-vaults-eth · block ≤ {latestBlock || "—"}</div>
        </div>
        <div className="yn-card">
          <h3>Total TVL</h3>
          <div className="big">{tvl.status === "ok" ? fmtUsd(tvl.totalUsd) : tvl.status === "loading" ? "…" : "—"}</div>
          <div className="sub">
            {tvl.status === "ok"
              ? `ETH @ $${tvl.ethUsd.toLocaleString()} · 5 Ethereum vaults`
              : "live from totalAssets() + Coingecko"}
          </div>
        </div>
        <div className="yn-card">
          <h3>Cumulative deposits (in-window)</h3>
          <div className="big">{totalAssets.toFixed(2)}</div>
          <div className="sub">mixed ETH/USDC · indexed events only</div>
        </div>
      </div>

      <div className="yn-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Cumulative deposits over time</h3>
          <div className="sub" style={{ marginBottom: 12 }}>sum of assets deposited, by block</div>
          {eth.status === "ok" ? <CumulativeTvlChart deposits={eth.deposits} /> : <ProofLoader />}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
        <div className="yn-card">
          <h3>Deposit volume (200-block buckets)</h3>
          <div className="sub" style={{ marginBottom: 12 }}>inflow per ~40-minute window</div>
          {eth.status === "ok" ? <DepositVolumeChart deposits={eth.deposits} /> : <ProofLoader />}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
        <div className="yn-card" style={{ gridColumn: "span 2" }}>
          <h3>Top depositors</h3>
          <div className="sub" style={{ marginBottom: 12 }}>summed asset value per owner address</div>
          {eth.status === "ok" ? <TopDepositorsChart deposits={eth.deposits} /> : <ProofLoader />}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
      </div>

      <h2 style={{ marginTop: 32, fontSize: 18 }}>Vaults</h2>
      <table className="yn-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Vault</th>
            <th>Chain</th>
            <th>TVL (USD)</th>
            <th>totalAssets()</th>
            <th>Indexer</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {VAULTS.map(v => {
            const isLive = registered.has(v.subgrove);
            const tvlCell = vaultUsd[v.symbol] !== undefined
              ? fmtUsd(vaultUsd[v.symbol])
              : "—";
            const assetsCell = vaultAssets[v.symbol]
              ? `${vaultAssets[v.symbol].amt.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${vaultAssets[v.symbol].underlying}`
              : <span className="yn-placeholder">—</span>;
            return (
              <tr key={v.symbol}>
                <td><strong>{v.symbol}</strong> <span className="yn-placeholder">· {v.name}</span></td>
                <td>Ethereum</td>
                <td>{tvlCell}</td>
                <td>{assetsCell}</td>
                <td>{v.subgrove === "yieldnest-vaults-eth" && eth.status === "ok"
                      ? <span style={{ color: "var(--yn-accent)" }}>live · {count} deposits</span>
                      : <span className="yn-placeholder">—</span>}</td>
                <td>{isLive
                    ? <SampleProofBadge subgrove={v.subgrove} />
                    : <span className="yn-placeholder">not registered</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
