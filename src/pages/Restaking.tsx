import { SubgroveStatus } from "../yieldnest/SubgroveStatus";

export function Restaking() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Restaking</h1>
      <p><SubgroveStatus id="yieldnest-restaking-eth" /></p>
      <p className="yn-placeholder">
        StakingNodesManager, EL/CL receivers, EigenLayer delegation — from yieldnest-restaking-eth.
      </p>
      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card"><h3>Total staked ETH</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>Active validators</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>EL rewards (30d)</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>CL rewards (30d)</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>Operators delegated to</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>AVS count</h3><div className="big yn-placeholder">—</div></div>
      </div>
    </section>
  );
}
