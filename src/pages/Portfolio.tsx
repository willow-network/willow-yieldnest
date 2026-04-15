import { useState } from "react";
import { SubgroveStatus } from "../yieldnest/SubgroveStatus";

export function Portfolio() {
  const [addr, setAddr] = useState("");
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Portfolio</h1>
      <p>
        <SubgroveStatus id="yieldnest-vaults-eth" />
      </p>
      <p className="yn-placeholder">
        Enter an EVM address to view positions across ynETH, ynLSDe, ynBNB, and MAX vaults.
        Queries yieldnest-vaults-* subgroves filtered by owner. (Data appears once an indexer is attached.)
      </p>
      <input
        value={addr}
        onChange={e => setAddr(e.target.value)}
        placeholder="0x..."
        style={{
          width: "100%", maxWidth: 520, marginTop: 12,
          background: "var(--yn-surface)", color: "var(--yn-text)",
          border: "1px solid var(--yn-border)", borderRadius: 8,
          padding: "10px 14px", fontSize: 14, fontFamily: "monospace"
        }}
      />
      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card"><h3>Total value</h3><div className="big yn-placeholder">—</div><div className="sub">across all yn* tokens</div></div>
        <div className="yn-card"><h3>Claimable rewards</h3><div className="big yn-placeholder">—</div><div className="sub">EL + CL accrued</div></div>
        <div className="yn-card"><h3>In exit queue</h3><div className="big yn-placeholder">—</div><div className="sub">est. wait</div></div>
      </div>
    </section>
  );
}
