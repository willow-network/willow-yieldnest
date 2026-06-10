/**
 * Loading state for the verifiable dashboard. Proof-backed data is in flight;
 * once it resolves, every figure can be re-verified on click. (Honest loader —
 * no fabricated counter; the real per-proof count belongs to the on-click
 * verify flow, not the bulk fetch.)
 */
export function ProofLoader({ label = "Loading proof-backed data" }: { label?: string }) {
  return (
    <div className="yn-proof-loader">
      <span className="yn-proof-spinner" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}
