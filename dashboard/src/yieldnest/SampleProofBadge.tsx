import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "./graphql";
import { ProofViewer } from "./ProofViewer";

type Props = {
  /** Subgrove to pull a sample entity from. */
  subgrove: string;
  /** Ordered list of entity types to try — first one with a hit wins. */
  entityTypes?: string[];
};

/** "Willow verified" badge for aggregate rows/cards — clicking opens the
 *  proof for *one* sample entity from the subgrove. Resolves gracefully if
 *  there's no data yet. */
export function SampleProofBadge({ subgrove, entityTypes = ["deposit", "transfer"] }: Props) {
  const [open, setOpen] = useState(false);
  const [sample, setSample] = useState<{ type: string; id: string } | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let alive = true;
    const probe = async () => {
      for (const t of entityTypes) {
        try {
          const d = await runQuery<any>(subgrove, `{ ${t}s(first: 1) { id } }`);
          const arr = d[`${t}s`] ?? [];
          if (arr.length > 0) {
            if (alive) setSample({ type: t, id: arr[0].id });
            return;
          }
        } catch (e) {
          if (e instanceof NoIndexingProgressError) continue;
          // transient error — try another type
        }
      }
      if (alive) setEmpty(true);
    };
    probe();
    return () => { alive = false; };
  }, [subgrove, entityTypes.join(",")]);

  if (empty || !sample) {
    return <span className="yn-proof-badge" title={empty ? "no entities yet" : "locating sample…"}>Willow verified</span>;
  }
  return (
    <>
      <span
        className="yn-proof-badge yn-proof-link"
        onClick={() => setOpen(true)}
        title="Click to see a sample Merkle proof"
      >Willow verified</span>
      {open && (
        <ProofViewer
          subgrove={subgrove}
          entityType={sample.type}
          entityIdField="id"
          entityId={sample.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
