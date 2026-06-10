import { useVerify } from "./Verify";

type Props = {
  subgrove: string;
  entityType: string;
  entityIdField?: string;
  entityId: string;
};

export function ProofBadge({ subgrove, entityType, entityIdField = "id", entityId }: Props) {
  const { verify } = useVerify();
  return (
    <span
      className="yn-proof-badge yn-proof-link"
      onClick={() => verify({ subgrove, entityType, entityIdField, entityId })}
      title="Click to verify the Merkle proof in your browser"
    >
      Willow verified
    </span>
  );
}
