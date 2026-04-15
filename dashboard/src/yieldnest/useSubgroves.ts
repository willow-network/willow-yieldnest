import { useEffect, useState } from "react";
import { listSubgroves, Subgrove } from "./api";

export type SubgrovesState =
  | { status: "loading" }
  | { status: "ok"; subgroves: Subgrove[] }
  | { status: "error"; message: string };

export function useSubgroves(): SubgrovesState {
  const [state, setState] = useState<SubgrovesState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    listSubgroves()
      .then(sg => alive && setState({ status: "ok", subgroves: sg }))
      .catch(e => alive && setState({ status: "error", message: String(e) }));
    return () => { alive = false; };
  }, []);
  return state;
}

export function useSubgrovesFiltered(prefix: string): SubgrovesState {
  const s = useSubgroves();
  if (s.status !== "ok") return s;
  return { status: "ok", subgroves: s.subgroves.filter(x => x.subgrove_id.startsWith(prefix)) };
}
