import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "./graphql";

// Entity types to probe, in order — first one with a row wins. Covers the
// subgroves this dashboard reads; harmless to try a type a subgrove lacks
// (the query errors and we move on).
const DEFAULT_TYPES = ["deposit", "transfer", "withdraw", "swap", "totalETHStakedUpdated"];

export type SampleState = { type: string; id: string } | "empty" | null;

/** Find one sample entity in a subgrove, so an aggregate surface (a pill, a
 *  chart) can offer a real proof to verify. `null` while probing, `"empty"`
 *  if the subgrove has no data yet. */
export function useSampleEntity(subgrove: string, entityTypes: string[] = DEFAULT_TYPES): SampleState {
  const [s, setS] = useState<SampleState>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const t of entityTypes) {
        try {
          const d = await runQuery<any>(subgrove, `{ ${t}s(first: 1) { id } }`);
          const arr = d[`${t}s`] ?? [];
          if (arr.length > 0) {
            if (alive) setS({ type: t, id: arr[0].id });
            return;
          }
        } catch (e) {
          if (e instanceof NoIndexingProgressError) continue;
          // transient/unknown type — try the next candidate
        }
      }
      if (alive) setS("empty");
    })();
    return () => { alive = false; };
  }, [subgrove, entityTypes.join(",")]);
  return s;
}
