import { useEffect, useState } from "react";
import { runQueryWithProof, WillowProof, bytesToHex } from "./graphql";

type Props = {
  subgrove: string;
  entityType: string;          // e.g. "deposit"
  entityIdField: string;       // e.g. "id"
  entityId: string;            // the id value
  onClose: () => void;
};

type State =
  | { status: "loading" }
  | { status: "ok"; proof: WillowProof | null; raw: string }
  | { status: "error"; message: string };

export function ProofViewer({ subgrove, entityType, entityIdField, entityId, onClose }: Props) {
  const [s, setS] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    // Fetch just this one entity + its proof.
    const query = `{ ${entityType}s(first: 1, where: { ${entityIdField}: "${entityId}" }) { ${entityIdField} } }`;
    runQueryWithProof<any>(subgrove, query)
      .then(({ data, proof }) => alive && setS({
        status: "ok", proof,
        raw: JSON.stringify({ query, data, proof }, null, 2),
      }))
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
            <div className="yn-grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div className="sub">State root</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                  {bytesToHex(s.proof.state_root)}
                </div>
              </div>
              <div>
                <div className="sub">Block height</div>
                <div style={{ fontFamily: "monospace", fontSize: 13 }}>
                  {s.proof.block_height.toLocaleString()}
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
              The indexer signed this state root at block{" "}
              <strong>{s.proof.block_height.toLocaleString()}</strong> and submitted it to Willow
              consensus. Any client can re-verify the GroveDB path against the state root without
              trusting the indexer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
