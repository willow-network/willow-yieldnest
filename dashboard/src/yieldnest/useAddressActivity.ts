import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "./graphql";

type Deposit = {
  id: string; caller: string; owner: string; assets: string; shares: string; blockNumber: string;
};
type Withdraw = {
  id: string; caller: string; owner: string; receiver: string; assets: string; shares: string; blockNumber: string;
};
type Transfer = {
  id: string; from: string; to: string; value: string; blockNumber: string;
};

export type AddressActivity = {
  deposits: Deposit[];
  withdraws: Withdraw[];
  transfersIn: Transfer[];
  transfersOut: Transfer[];
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: AddressActivity }
  | { status: "error"; message: string };

/** Pull everything from a subgrove and filter client-side by lowercased address.
 *  Willow's GraphQL doesn't expose a `where: { owner: "..." }` filter yet, so we
 *  fetch and filter in JS. */
export function useAddressActivity(subgrove: string, addr: string): State {
  const [s, setS] = useState<State>({ status: "idle" });
  useEffect(() => {
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setS({ status: "idle" });
      return;
    }
    let alive = true;
    setS({ status: "loading" });
    const lc = addr.toLowerCase();

    const runOnce = async () => {
      try {
        // Three separate queries so each fetch/parse can yield to the event
        // loop — avoids a big synchronous filter pass freezing the tab.
        const [depRes, wdRes, txRes] = await Promise.all([
          runQuery<{ deposits: Deposit[] }>(
            subgrove,
            `{ deposits(first: 500)  { id caller owner assets shares blockNumber } }`),
          runQuery<{ withdraws: Withdraw[] }>(
            subgrove,
            `{ withdraws(first: 500) { id caller owner receiver assets shares blockNumber } }`),
          runQuery<{ transfers: Transfer[] }>(
            subgrove,
            `{ transfers(first: 500) { id from to value blockNumber } }`),
        ]);
        if (!alive) return;
        const deposits = (depRes.deposits ?? []).filter(x => (x.owner ?? "").toLowerCase() === lc);
        const withdraws = (wdRes.withdraws ?? []).filter(x => (x.owner ?? "").toLowerCase() === lc);
        const transfers = txRes.transfers ?? [];
        const transfersIn = transfers.filter(x => (x.to ?? "").toLowerCase() === lc);
        const transfersOut = transfers.filter(x => (x.from ?? "").toLowerCase() === lc);
        if (!alive) return;
        setS({ status: "ok", data: { deposits, withdraws, transfersIn, transfersOut } });
      } catch (e) {
        if (!alive) return;
        if (e instanceof NoIndexingProgressError) {
          setS({ status: "ok", data: { deposits: [], withdraws: [], transfersIn: [], transfersOut: [] } });
        } else {
          setS({ status: "error", message: String(e) });
        }
      }
    };

    // Debounce: wait 300ms after addr/subgrove changes before firing.
    const first = setTimeout(runOnce, 300);
    // Refresh every 10s while the address is focused.
    const refresh = setInterval(runOnce, 10_000);
    return () => { alive = false; clearTimeout(first); clearInterval(refresh); };
  }, [subgrove, addr]);
  return s;
}
