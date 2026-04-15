import { useSubgroves } from "./useSubgroves";

export function SubgroveStatus({ id }: { id: string }) {
  const s = useSubgroves();
  if (s.status !== "ok") return <span className="yn-placeholder">checking…</span>;
  const sg = s.subgroves.find(x => x.subgrove_id === id);
  if (!sg) return <span className="yn-placeholder">{id} not registered</span>;
  return (
    <span style={{ fontSize: 12, color: "var(--yn-text-dim)" }}>
      <span className="yn-proof-badge">Willow verified</span>{" "}
      subgrove <code>{id}</code> · created block {sg.created_at}
    </span>
  );
}
