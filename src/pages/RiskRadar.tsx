import { SubgroveStatus } from "../yieldnest/SubgroveStatus";

export function RiskRadar() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Risk Radar</h1>
      <p><SubgroveStatus id="yieldnest-liquidity" /></p>
      <p className="yn-placeholder">
        The 12 indicators YieldNest surfaces on IntoTheBlock — sourced from the yieldnest-liquidity
        subgrove with cryptographic proofs.
      </p>
      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card"><h3>DEX depth (ynETH)</h3><div className="big yn-placeholder">—</div><div className="sub">Curve ynETH/wstETH</div></div>
        <div className="yn-card"><h3>Slippage @ 10 ETH</h3><div className="big yn-placeholder">—</div><div className="sub">last 24h median</div></div>
        <div className="yn-card"><h3>Pool asset ratio</h3><div className="big yn-placeholder">—</div><div className="sub">ynETH : wstETH</div></div>
        <div className="yn-card"><h3>Exit queue</h3><div className="big yn-placeholder">—</div><div className="sub">from yieldnest-restaking-eth</div></div>
      </div>
    </section>
  );
}
