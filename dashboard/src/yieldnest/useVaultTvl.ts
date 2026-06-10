import { useEffect, useState } from "react";

// Per-vault TVL: call totalAssets() on each ERC-4626 vault and multiply by a
// spot USD price for the underlying.
type VaultDef = {
  symbol: string;
  address: string;
  underlying: "ETH" | "USD" | "BTC";
  decimals: number;
};

const ETH_VAULTS: VaultDef[] = [
  { symbol: "ynETH",  address: "0x09db87A538BD693E9d08544577d5cCfAA6373A48", underlying: "ETH", decimals: 18 },
  { symbol: "ynLSDe", address: "0x35Ec69A77B79c255e5d47D5A3BdbEFEfE342630c", underlying: "ETH", decimals: 18 },
  { symbol: "ynETHx", address: "0x657d9ABA1DBb59e53f9F3eCAA878447dCfC96dCb", underlying: "ETH", decimals: 18 },
  { symbol: "ynUSDx", address: "0x3DB228FE836D99Ccb25Ec4dfdC80ED6d2CDdCB4b", underlying: "USD", decimals: 6  },
  { symbol: "ynRWAx", address: "0x01Ba69727E2860b37bc1a2bd56999c1aFb4C15D8", underlying: "USD", decimals: 6  },
];

// totalAssets() selector = keccak256("totalAssets()")[:4]
const TOTAL_ASSETS_SELECTOR = "0x01e1d114";
const RPC = (import.meta as any).env?.VITE_ETH_RPC ?? "/eth-rpc";
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd";

async function ethCall(to: string, data: string): Promise<string> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const body = await r.json();
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return body.result as string;
}

function hexToNumber(hex: string, decimals: number): number {
  if (!hex || hex === "0x") return 0;
  try {
    const big = BigInt(hex);
    const scale = 10n ** BigInt(decimals);
    const whole = Number(big / scale);
    const frac = Number(big % scale) / Number(scale);
    return whole + frac;
  } catch { return 0; }
}

export type VaultTvl = {
  symbol: string;
  underlying: string;
  totalAssets: number;   // in underlying units
  usd: number;
  error?: string;
};

type State =
  | { status: "loading" }
  | { status: "ok"; perVault: VaultTvl[]; totalUsd: number; ethUsd: number; btcUsd: number; updatedAt: number }
  | { status: "error"; message: string };

export function useVaultTvl(refreshMs = 30_000): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        // Prices — Coingecko is public, no key needed. Single call covers both.
        const priceRes = await fetch(COINGECKO);
        const prices = await priceRes.json();
        const ethUsd = prices?.ethereum?.usd ?? 3400;
        const btcUsd = prices?.bitcoin?.usd  ?? 90000;

        // totalAssets() per vault — parallel.
        const perVault = await Promise.all(ETH_VAULTS.map(async v => {
          try {
            const hex = await ethCall(v.address, TOTAL_ASSETS_SELECTOR);
            const totalAssets = hexToNumber(hex, v.decimals);
            const priceUsd =
              v.underlying === "ETH" ? ethUsd :
              v.underlying === "BTC" ? btcUsd : 1;
            return { symbol: v.symbol, underlying: v.underlying, totalAssets, usd: totalAssets * priceUsd };
          } catch (e) {
            return {
              symbol: v.symbol, underlying: v.underlying, totalAssets: 0, usd: 0,
              error: String(e),
            } as VaultTvl;
          }
        }));
        const totalUsd = perVault.reduce((n, v) => n + v.usd, 0);
        if (!alive) return;
        setS({ status: "ok", perVault, totalUsd, ethUsd, btcUsd, updatedAt: Date.now() });
      } catch (e) {
        if (!alive) return;
        setS({ status: "error", message: String(e) });
      }
    };
    tick();
    const id = setInterval(tick, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [refreshMs]);
  return s;
}

export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
