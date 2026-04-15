import { VAULTS } from "../yieldnest/config";
import { useSubgroves } from "../yieldnest/useSubgroves";

export function Earn() {
  const s = useSubgroves();
  const registered = s.status === "ok"
    ? new Set(s.subgroves.map(x => x.subgrove_id))
    : new Set<string>();

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Earn</h1>
      <p className="yn-placeholder">
        Per-vault TVL / APY / exchange rate — sourced from Willow subgroves with proof verification.
      </p>

      <div className="yn-grid" style={{ marginBottom: 24 }}>
        <div className="yn-card">
          <h3>Subgroves online</h3>
          <div className="big">{s.status === "ok" ? s.subgroves.length : "—"}</div>
          <div className="sub">{s.status === "loading" ? "querying node…" : s.status === "error" ? s.message : "live on Willow"}</div>
        </div>
        <div className="yn-card">
          <h3>Vaults tracked</h3>
          <div className="big">{VAULTS.length}</div>
          <div className="sub">across Ethereum + BNB</div>
        </div>
        <div className="yn-card">
          <h3>Total TVL</h3>
          <div className="big yn-placeholder">—</div>
          <div className="sub">requires indexer attached</div>
        </div>
      </div>

      <table className="yn-table">
        <thead>
          <tr>
            <th>Vault</th>
            <th>Chain</th>
            <th>Subgrove</th>
            <th>TVL</th>
            <th>APY</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {VAULTS.map(v => {
            const isLive = registered.has(v.subgrove);
            return (
              <tr key={v.symbol}>
                <td><strong>{v.symbol}</strong> <span className="yn-placeholder">· {v.name}</span></td>
                <td>{v.chainId === 1 ? "Ethereum" : v.chainId === 56 ? "BNB" : `chain ${v.chainId}`}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.subgrove}</td>
                <td className="yn-placeholder">—</td>
                <td className="yn-placeholder">—</td>
                <td>
                  {isLive
                    ? <span className="yn-proof-badge">Willow verified</span>
                    : <span className="yn-placeholder">not registered</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
