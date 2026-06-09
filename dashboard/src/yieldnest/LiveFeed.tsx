import { useDeposits, Deposit, assetsNumberHeuristic } from "./useDeposits";
import { ProofBadge } from "./ProofBadge";
import { ProofLoader } from "./ProofLoader";
import { CopyAddress } from "./CopyAddress";

export function LiveFeed({ subgrove }: { subgrove: string }) {
  // Only the latest 12 are shown — fetch just those (newest-first) instead of
  // the full set, which keeps the attached proof small on the landing page.
  const s = useDeposits(subgrove, { first: 12, orderDesc: true });
  const latest: Deposit[] =
    s.status === "ok"
      ? [...s.deposits].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber)).slice(0, 12)
      : [];
  return (
    <div className="yn-card" style={{ gridColumn: "span 2" }}>
      <h3>Live deposit feed</h3>
      <div className="sub" style={{ marginBottom: 12 }}>
        streaming from <code>{subgrove}</code> · new rows arrive as the indexer decodes them
      </div>
      {s.status === "loading" && <ProofLoader />}
      {s.status === "error" && <p className="yn-placeholder">error: {s.message}</p>}
      {s.status === "ok" && latest.length === 0 && (
        <p className="yn-placeholder">no entities yet</p>
      )}
      {s.status === "ok" && latest.length > 0 && (
        <table className="yn-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Depositor</th>
              <th>Assets</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {latest.map(d => (
              <tr key={d.id}>
                <td>{d.blockNumber}</td>
                <td>
                  {d.owner ? <CopyAddress addr={d.owner} /> : "—"}
                </td>
                <td>{assetsNumberHeuristic(d).toFixed(4)}</td>
                <td><ProofBadge subgrove={subgrove} entityType="deposit" entityId={d.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
