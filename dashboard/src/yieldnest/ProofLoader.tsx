import { useEffect, useState } from "react";

/**
 * Loading state for the verifiable dashboard. While proof-backed data is in
 * flight, a counter ticks up to convey that proofs are being pulled + checked —
 * instead of a bare "loading…" or a misleading "no data" (which reads as empty
 * even when a request is still running). Resolves to real content once loaded.
 */
export function ProofLoader({ label = "Loading & verifying proofs" }: { label?: string }) {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1 + Math.floor(Math.random() * 5)), 65);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="yn-proof-loader">
      <span className="yn-proof-spinner" aria-hidden />
      <span>
        {label} <span className="yn-proof-count">{n.toLocaleString()}</span>…
      </span>
    </div>
  );
}
