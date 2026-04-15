import { useEffect, useState } from "react";
import { runQuery } from "./graphql";

export type VaultActivity = {
  depositsCount: number;
  transfersCount: number;
  latestBlock: number;
  recentDeposits: Array<{
    id: string;
    caller: string;
    owner: string;
    assets: string;
    shares: string;
    blockNumber: string;
  }>;
};

type State =
  | { status: "loading" }
  | { status: "ok"; data: VaultActivity }
  | { status: "error"; message: string };

export function useVaultActivity(subgrove: string): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        // Two separate queries — Willow's GraphQL merges selections by field name
        // even when aliased, so reusing `deposits` twice drops fields. Keep them split.
        const [recent, all] = await Promise.all([
          runQuery<{ deposits: VaultActivity["recentDeposits"] }>(
            subgrove,
            `{ deposits(first: 5, orderBy: blockNumber, orderDirection: desc) {
                id caller owner assets shares blockNumber
              } }`,
          ),
          runQuery<{ deposits: Array<{ id: string; blockNumber: string }> }>(
            subgrove,
            `{ deposits(first: 1000) { id blockNumber } }`,
          ),
        ]);

        const deposits = all.deposits ?? [];
        const latest = deposits.reduce(
          (m: number, x: any) => Math.max(m, Number(x.blockNumber ?? 0)),
          0,
        );
        if (!alive) return;
        setS({
          status: "ok",
          data: {
            depositsCount: deposits.length,
            transfersCount: 0,
            latestBlock: latest,
            recentDeposits: (recent.deposits ?? []).filter(d => d && d.owner),
          },
        });
      } catch (e) {
        if (!alive) return;
        setS({ status: "error", message: String(e) });
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [subgrove]);
  return s;
}
