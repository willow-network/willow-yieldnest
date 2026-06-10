import { useVerify } from "./Verify";
import { useSampleEntity } from "./useSampleEntity";

type Props = {
  /** Subgrove to pull a sample entity from. */
  subgrove: string;
  /** Ordered entity types to try — first one with a row wins. */
  entityTypes?: string[];
};

/** "Willow verified" badge for aggregate rows/cards — clicking verifies one
 *  sample entity's proof from the subgrove. Resolves gracefully if there's no
 *  data yet. */
export function SampleProofBadge({ subgrove, entityTypes }: Props) {
  const { verify } = useVerify();
  const sample = useSampleEntity(subgrove, entityTypes);
  if (sample === null || sample === "empty") {
    return (
      <span className="yn-proof-badge" title={sample === "empty" ? "no entities yet" : "locating sample…"}>
        Willow verified
      </span>
    );
  }
  return (
    <span
      className="yn-proof-badge yn-proof-link"
      onClick={() => verify({ subgrove, entityType: sample.type, entityId: sample.id })}
      title="Click to verify a sample Merkle proof in your browser"
    >
      Willow verified
    </span>
  );
}
