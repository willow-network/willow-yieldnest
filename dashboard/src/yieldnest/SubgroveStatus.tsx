import { useSubgroves } from "./useSubgroves";
import { useSampleEntity } from "./useSampleEntity";
import { useVerify } from "./Verify";

export function SubgroveStatus({ id }: { id: string | string[] }) {
  const s = useSubgroves();
  const ids = Array.isArray(id) ? id : [id];
  const sample = useSampleEntity(ids[0]);
  const { verify } = useVerify();

  if (s.status !== "ok") return <span className="yn-placeholder">checking…</span>;
  const rows = ids.map(i => ({ id: i, sg: s.subgroves.find(x => x.subgrove_id === i) }));
  if (rows.every(r => !r.sg)) {
    return <span className="yn-placeholder">{ids.join(", ")} not registered</span>;
  }
  const multi = ids.length > 1;

  // The pill is a live verify affordance: clicking checks a real proof from the
  // subgrove in the browser (not just a registration label).
  const pill = sample && sample !== "empty" ? (
    <span
      className="yn-proof-badge yn-proof-link"
      onClick={() => verify({ subgrove: ids[0], entityType: sample.type, entityId: sample.id })}
      title="Click to verify a proof from this subgrove in your browser"
    >
      Willow verified
    </span>
  ) : (
    <span className="yn-proof-badge">Willow verified</span>
  );

  return (
    <span style={{ fontSize: 12, color: "var(--yn-text-dim)" }}>
      {pill}{" "}
      {multi ? "subgroves " : "subgrove "}
      {rows.map((r, idx) => (
        <span key={r.id}>
          {idx > 0 ? " · " : ""}
          <code>{r.id}</code>
          {r.sg
            ? (multi ? ` (block ${r.sg.created_at})` : ` · created block ${r.sg.created_at}`)
            : " (not registered)"}
        </span>
      ))}
    </span>
  );
}
