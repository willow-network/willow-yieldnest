import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "./graphql";

export type Deposit = {
  id: string;
  caller: string;
  owner: string;
  assets: string;
  shares: string;
  blockNumber: string;
  timestamp?: string;
};

type State =
  | { status: "loading" }
  | { status: "ok"; deposits: Deposit[] }
  | { status: "error"; message: string };

/** Fetch all (up to 5000) deposits for a subgrove, refreshing every 5s. */
export function useDeposits(subgrove: string): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await runQuery<{ deposits: Deposit[] }>(
          subgrove,
          `{ deposits(first: 5000) {
              id caller owner assets shares blockNumber timestamp
            } }`,
        );
        if (!alive) return;
        setS({ status: "ok", deposits: d.deposits ?? [] });
      } catch (e) {
        if (!alive) return;
        if (e instanceof NoIndexingProgressError) {
          setS({ status: "ok", deposits: [] });
        } else {
          setS({ status: "error", message: String(e) });
        }
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [subgrove]);
  return s;
}

/** Convert wei-style bigint string to a Number with decimals, for charting. */
export function toNumber18(s: string): number {
  try {
    const n = BigInt(s);
    return Number(n) / 1e18;
  } catch {
    return 0;
  }
}

/** Deposits are a mix of ERC4626 token scales (18) and USDC (6). Heuristic:
 *  if the shares value is already small, divide assets by 1e6; else 1e18.
 */
export function assetsNumberHeuristic(d: Deposit): number {
  try {
    const shares = BigInt(d.shares);
    const assets = BigInt(d.assets);
    // Heuristic: if assets << 1e15 it's probably a 6-decimal stablecoin.
    if (assets < 10n ** 15n) return Number(assets) / 1e6;
    return Number(assets) / 1e18;
    void shares;
  } catch {
    return 0;
  }
}
