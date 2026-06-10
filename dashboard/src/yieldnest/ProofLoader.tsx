import { useEffect, useState } from "react";

/**
 * Loading state for the verifiable dashboard. Proof-backed data is in flight;
 * once it resolves, every figure can be re-verified on click. Honest loader —
 * no fabricated counter. If the load drags (e.g. the indexer is mid-backfill
 * and the query path is busy), it escalates to a truthful "catching up"
 * message instead of spinning silently and looking broken.
 */
export function ProofLoader({ label = "Loading proof-backed data" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="yn-proof-loader">
      <span className="yn-proof-spinner" aria-hidden />
      <span>{slow ? "Indexer is catching up — this can take a moment" : label}…</span>
    </div>
  );
}
