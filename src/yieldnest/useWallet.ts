import { useCallback, useEffect, useState } from "react";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
};

declare global {
  interface Window { ethereum?: EthereumProvider }
}

export function useWallet() {
  const [addr, setAddr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = typeof window !== "undefined" && !!window.ethereum;

  // Pick up an already-authorised account on mount without prompting.
  useEffect(() => {
    if (!available) return;
    window.ethereum!
      .request({ method: "eth_accounts" })
      .then((accs: string[]) => {
        if (accs?.[0]) setAddr(accs[0]);
      })
      .catch(() => { /* ignore */ });

    const onChange = (accs: string[]) => setAddr(accs?.[0] ?? null);
    window.ethereum?.on?.("accountsChanged", onChange);
    return () => window.ethereum?.removeListener?.("accountsChanged", onChange);
  }, [available]);

  const connect = useCallback(async () => {
    if (!window.ethereum) { setError("No EVM wallet detected"); return; }
    try {
      const accs: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accs?.[0]) { setAddr(accs[0]); setError(null); }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const disconnect = useCallback(() => setAddr(null), []);

  return { available, addr, error, connect, disconnect };
}
