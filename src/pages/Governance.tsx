import { SubgroveStatus } from "../yieldnest/SubgroveStatus";

export function Governance() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Governance</h1>
      <p><SubgroveStatus id="yieldnest-governance" /></p>
      <p className="yn-placeholder">
        YND token activity across 7 chains — from yieldnest-governance.
      </p>
      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card"><h3>Total supply</h3><div className="big yn-placeholder">—</div><div className="sub">summed across chains</div></div>
        <div className="yn-card"><h3>Holders</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>Top holder share</h3><div className="big yn-placeholder">—</div></div>
        <div className="yn-card"><h3>Delegations (7d)</h3><div className="big yn-placeholder">—</div></div>
      </div>
    </section>
  );
}
