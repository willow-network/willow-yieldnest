import { useVerify } from "./Verify";

type Props = {
  subgrove: string;
  /** Query whose full result set backs the aggregate this badge sits on. */
  query: string;
  /** Human label shown while verifying (e.g. "indexed deposits"). */
  label: string;
};

/** "Willow verified" badge for an aggregate card. Clicking batch-verifies every
 *  proof behind the figure in the browser, with a live running count. */
export function VerifyAllBadge({ subgrove, query, label }: Props) {
  const { verifySet } = useVerify();
  return (
    <span
      className="yn-proof-badge yn-proof-link"
      onClick={() => verifySet({ subgrove, query, label })}
      title="Click to verify every proof behind this figure in your browser"
    >
      Willow verified
    </span>
  );
}
