import { useSubgroves } from "./useSubgroves";

export function SubgroveStatus({ id }: { id: string | string[] }) {
  const s = useSubgroves();
  if (s.status !== "ok") return <span className="yn-placeholder">checking…</span>;
  const ids = Array.isArray(id) ? id : [id];
  const rows = ids.map(i => ({ id: i, sg: s.subgroves.find(x => x.subgrove_id === i) }));
  if (rows.every(r => !r.sg)) {
    return <span className="yn-placeholder">{ids.join(", ")} not registered</span>;
  }
  const multi = ids.length > 1;
  return (
    <span style={{ fontSize: 12, color: "var(--yn-text-dim)" }}>
      <span className="yn-proof-badge">Willow verified</span>{" "}
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
