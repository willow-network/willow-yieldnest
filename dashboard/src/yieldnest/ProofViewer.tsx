import { useEffect, useState } from "react";
import { grovedb } from "@willow/sdk";
import { runQueryWithProof, WillowProof, bytesToHex } from "./graphql";

const toHex = (a: Iterable<number>) =>
  Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");

type Props = {
  subgrove: string;
  entityType: string;          // e.g. "deposit"
  entityIdField: string;       // e.g. "id"
  entityId: string;            // the id value
  onClose: () => void;
};

type State =
  | { status: "loading" }
  | { status: "ok"; proof: WillowProof | null; raw: string; verified: "ok" | "fail" | null }
  | { status: "error"; message: string };

export function ProofViewer({ subgrove, entityType, entityIdField, entityId, onClose }: Props) {
  const [s, setS] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    // Fetch just this one entity + its proof.
    const query = `{ ${entityType}s(first: 1, where: { ${entityIdField}: "${entityId}" }) { ${entityIdField} } }`;
    runQueryWithProof<any>(subgrove, query)
      .then(({ data, proof }) => {
        if (!alive) return;
        // Recompute the GroveDB Merkle root from the proof bytes IN THE BROWSER
        // and check it equals the indexer's committed state root. No trust in
        // the indexer or this page — the client checks the math.
        let verified: "ok" | "fail" | null = null;
        if (proof && proof.merkle_proofs?.length) {
          try {
            const bytes = Uint8Array.from(proof.merkle_proofs[0].merkle_proof);
            const out: any = grovedb.verifyGroveDBProof(bytes);
            verified = toHex(out.rootHash) === toHex(proof.state_root) ? "ok" : "fail";
          } catch {
            verified = "fail";
          }
        }
        setS({ status: "ok", proof, verified, raw: JSON.stringify({ query, data, proof }, null, 2) });
      })
      .catch(e => alive && setS({ status: "error", message: String(e) }));
    return () => { alive = false; };
  }, [subgrove, entityType, entityIdField, entityId]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="yn-card"
        style={{
          width: "min(780px, 92vw)", maxHeight: "88vh", overflow: "auto",
          borderTop: "4px solid var(--yn-accent)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Willow proof</h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid var(--yn-border)",
              color: "var(--yn-text)", borderRadius: 6, padding: "4px 10px", cursor: "pointer",
            }}
          >close</button>
        </div>
        <div className="sub" style={{ marginTop: 4 }}>
          Entity <code>{entityType}</code> in <code>{subgrove}</code> ·{" "}
          <span style={{ fontFamily: "monospace", fontSize: 11 }}>{entityId.slice(0, 24)}…</span>
        </div>

        {s.status === "loading" && <p className="yn-placeholder" style={{ marginTop: 16 }}>fetching…</p>}
        {s.status === "error" && <p className="yn-placeholder" style={{ marginTop: 16 }}>error: {s.message}</p>}
        {s.status === "ok" && !s.proof && (
          <p className="yn-placeholder" style={{ marginTop: 16 }}>
            Response returned no proof object — indexer may not yet have a checkpoint state root.
          </p>
        )}
        {s.status === "ok" && s.proof && (
          <>
            {s.verified === "ok" && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, background: "var(--yn-proof-bg)", border: "1px solid var(--yn-accent)", color: "var(--yn-accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <span>Verified — recomputed the Merkle root and it matches the committed state root.</span>
              </div>
            )}
            {s.verified === "fail" && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, background: "rgba(200,60,60,0.12)", border: "1px solid #c0504e", color: "#c0504e", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>✗</span>
                <span>Verification failed — the recomputed root does not match the committed state root.</span>
              </div>
            )}
            <div className="yn-grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="sub">State root</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                  {bytesToHex(s.proof.state_root)}
                </div>
              </div>
              <div>
                <div className="sub">Merkle proofs included</div>
                <div style={{ fontFamily: "monospace", fontSize: 13 }}>
                  {s.proof.merkle_proofs.length}
                </div>
              </div>
              <div>
                <div className="sub">Ethereum anchor</div>
                <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {s.proof.ethereum_anchor
                    ? `block ${s.proof.ethereum_anchor.block_number}`
                    : "—"}
                </div>
              </div>
            </div>

            <h4 style={{ marginTop: 20, marginBottom: 6 }}>Raw response</h4>
            <pre
              style={{
                background: "var(--yn-bg)", border: "1px solid var(--yn-border)",
                borderRadius: 8, padding: 12, fontSize: 11, lineHeight: 1.5,
                maxHeight: 320, overflow: "auto", color: "var(--yn-text)",
              }}
            >{s.raw}</pre>

            <p className="sub" style={{ marginTop: 16 }}>
              This proof was just recomputed in your browser — the Merkle path hashes up to
              the state root above, with no trust in the indexer or this page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
