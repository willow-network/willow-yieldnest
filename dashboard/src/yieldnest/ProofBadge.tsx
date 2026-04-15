import { useState } from "react";
import { ProofViewer } from "./ProofViewer";

type Props = {
  subgrove: string;
  entityType: string;
  entityIdField?: string;
  entityId: string;
};

export function ProofBadge({ subgrove, entityType, entityIdField = "id", entityId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        className="yn-proof-badge yn-proof-link"
        onClick={() => setOpen(true)}
        title="Click to see the Merkle proof"
      >
        Willow verified
      </span>
      {open && (
        <ProofViewer
          subgrove={subgrove}
          entityType={entityType}
          entityIdField={entityIdField}
          entityId={entityId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
