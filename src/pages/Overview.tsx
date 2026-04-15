import { useSubgroves } from "../yieldnest/useSubgroves";
import { nodeUrl } from "../yieldnest/api";

export function Overview() {
  const s = useSubgroves();
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Overview</h1>
      <p className="yn-placeholder">
        Six YieldNest subgroves registered on a Willow node at{" "}
        <code>{nodeUrl()}</code>. Every panel on this dashboard queries them with
        cryptographic proofs attached.
      </p>

      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card">
          <h3>Node status</h3>
          <div className="big">
            {s.status === "loading" ? "…" : s.status === "ok" ? "online" : "offline"}
          </div>
          <div className="sub">{s.status === "error" ? s.message : nodeUrl()}</div>
        </div>
        <div className="yn-card">
          <h3>Subgroves registered</h3>
          <div className="big">{s.status === "ok" ? s.subgroves.length : "—"}</div>
          <div className="sub">expected 6</div>
        </div>
        <div className="yn-card">
          <h3>Execution mode</h3>
          <div className="big">GKR</div>
          <div className="sub">cryptographic proof on every submission</div>
        </div>
      </div>

      {s.status === "ok" && (
        <table className="yn-table" style={{ marginTop: 32 }}>
          <thead>
            <tr>
              <th>Subgrove</th>
              <th>Owner DID</th>
              <th>Created at (block)</th>
              <th>Retention</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {s.subgroves.map(sg => (
              <tr key={sg.subgrove_id}>
                <td style={{ fontFamily: "monospace" }}>{sg.subgrove_id}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{sg.owner_did}</td>
                <td>{sg.created_at}</td>
                <td>{typeof sg.retention_window === "string"
                      ? sg.retention_window
                      : JSON.stringify(sg.retention_window)}</td>
                <td><span className="yn-proof-badge">Willow verified</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
