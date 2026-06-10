import { useEffect, useState } from "react";
import { grovedb } from "@willow/sdk";
import { runQueryWithProof, bytesToHex } from "./graphql";

const toHex = (a: Iterable<number>) =>
  Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");

type Props = {
  subgrove: string;
  /** Query whose result set backs the aggregate (e.g. all deposits behind TVL). */
  query: string;
  /** What the aggregate represents, shown in the modal (e.g. "Total TVL"). */
  label: string;
  onClose: () => void;
};

type State = {
  phase: "loading" | "verifying" | "done" | "error";
  verified: number;
  failed: number;
  total: number;
  root?: string;
  message?: string;
};

/**
 * Verifies the whole set of proofs behind an aggregate, in the browser, with a
 * REAL running count. One request fetches the result set together with one
 * Merkle proof per entity; we then recompute each proof's root locally and
 * check it against the committed state root, ticking the counter as we go.
 */
export function BatchVerifyViewer({ subgrove, query, label, onClose }: Props) {
  const [s, setS] = useState<State>({ phase: "loading", verified: 0, failed: 0, total: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { proof } = await runQueryWithProof<any>(subgrove, query);
        if (!alive) return;
        if (!proof || !proof.merkle_proofs?.length) {
          setS({ phase: "error", verified: 0, failed: 0, total: 0, message: "indexer returned no proofs" });
          return;
        }
        const expected = toHex(proof.state_root);
        const total = proof.merkle_proofs.length;
        setS({ phase: "verifying", verified: 0, failed: 0, total });
        let verified = 0, failed = 0;
        for (let i = 0; i < total; i++) {
          if (!alive) return;
          const mp = proof.merkle_proofs[i];
          try {
            const out: any = grovedb.verifyGroveDBProof(Uint8Array.from(mp.merkle_proof));
            if (toHex(out.rootHash) === expected) verified++;
            else failed++;
          } catch {
            failed++;
          }
          // Update the count + yield to the event loop periodically so the
          // counter actually paints as it climbs (no artificial delay).
          if (i % 8 === 0 || i === total - 1) {
            setS((p) => ({ ...p, verified, failed }));
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        if (!alive) return;
        setS({ phase: "done", verified, failed, total, root: bytesToHex(proof.state_root) });
      } catch (e) {
        if (alive) setS({ phase: "error", verified: 0, failed: 0, total: 0, message: String(e) });
      }
    })();
    return () => { alive = false; };
  }, [subgrove, query]);

  const ok = s.phase === "done" && s.failed === 0;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="yn-card"
        style={{ width: "min(620px, 92vw)", borderTop: "4px solid var(--yn-accent)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Verifying {label}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--yn-border)", color: "var(--yn-text)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>close</button>
        </div>
        <div className="sub" style={{ marginTop: 4 }}>
          recomputing every proof behind this figure in your browser
        </div>

        {(s.phase === "loading" || s.phase === "verifying") && (
          <div className="yn-proof-loader" style={{ marginTop: 20 }}>
            <span className="yn-proof-spinner" aria-hidden />
            <span>
              {s.phase === "loading"
                ? "Fetching proofs…"
                : <>Verified <span className="yn-proof-count">{s.verified.toLocaleString()}</span>{s.total ? ` / ${s.total.toLocaleString()}` : ""} proofs…</>}
            </span>
          </div>
        )}

        {s.phase === "done" && (
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 8, fontWeight: 600,
            background: ok ? "var(--yn-proof-bg)" : "rgba(200,60,60,0.12)",
            border: `1px solid ${ok ? "var(--yn-accent)" : "#c0504e"}`,
            color: ok ? "var(--yn-accent)" : "#c0504e" }}>
            {ok
              ? `✓ Verified all ${s.verified.toLocaleString()} proofs in your browser — every one recomputes to the committed state root.`
              : `✗ ${s.failed.toLocaleString()} of ${s.total.toLocaleString()} proofs failed to match the committed state root.`}
          </div>
        )}
        {s.phase === "done" && s.root && (
          <div style={{ marginTop: 14 }}>
            <div className="sub">Committed state root</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{s.root}</div>
          </div>
        )}

        {s.phase === "error" && (
          <p className="yn-placeholder" style={{ marginTop: 20 }}>couldn't verify: {s.message}</p>
        )}
      </div>
    </div>
  );
}
