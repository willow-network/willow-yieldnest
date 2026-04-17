import { useEffect, useState } from "react";
import { SubgroveStatus } from "../yieldnest/SubgroveStatus";
import { ProofBadge } from "../yieldnest/ProofBadge";
import { useAddressActivity } from "../yieldnest/useAddressActivity";
import { assetsNumberHeuristic } from "../yieldnest/useDeposits";
import { useWallet } from "../yieldnest/useWallet";
import { CopyAddress } from "../yieldnest/CopyAddress";

function fmtAssets(s: string): string {
  return assetsNumberHeuristic({ assets: s, shares: "0" } as any).toFixed(4);
}

export function Portfolio() {
  const [addr, setAddr] = useState("");
  const wallet = useWallet();
  // When the wallet connects (or flips accounts), autofill the input.
  useEffect(() => { if (wallet.addr) setAddr(wallet.addr); }, [wallet.addr]);
  const activity = useAddressActivity("yieldnest-vaults-eth", addr);

  const summary =
    activity.status === "ok"
      ? {
          deposited: activity.data.deposits.reduce((n, d) => n + assetsNumberHeuristic(d as any), 0),
          withdrawn: activity.data.withdraws.reduce((n, w) => n + assetsNumberHeuristic(w as any), 0),
          inflows: activity.data.transfersIn.length,
          outflows: activity.data.transfersOut.length,
          events: activity.data.deposits.length + activity.data.withdraws.length +
                  activity.data.transfersIn.length + activity.data.transfersOut.length,
        }
      : null;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Portfolio</h1>
      <p><SubgroveStatus id="yieldnest-vaults-eth" /></p>
      <p className="yn-placeholder">
        Paste an EVM address to view its YieldNest activity across Ethereum vaults. Filters deposits,
        withdrawals, and ynToken transfers for that address — every hit is cryptographically verified
        via the Willow indexer.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <input
          value={addr}
          onChange={e => setAddr(e.target.value.trim())}
          placeholder="0x…"
          spellCheck={false}
          style={{
            flex: "1 1 420px", maxWidth: 520,
            background: "var(--yn-surface)", color: "var(--yn-text)",
            border: "1px solid var(--yn-border)", borderRadius: 8,
            padding: "10px 14px", fontSize: 14, fontFamily: "monospace",
          }}
        />
        <button
          onClick={() => {/* addr state already drives the hook — this is a UX hint */}}
          disabled={!/^0x[a-fA-F0-9]{40}$/.test(addr)}
          style={{
            background: /^0x[a-fA-F0-9]{40}$/.test(addr) ? "var(--yn-accent)" : "var(--yn-border)",
            color: /^0x[a-fA-F0-9]{40}$/.test(addr) ? "#fff" : "var(--yn-text-dim)",
            border: "none", borderRadius: 8,
            padding: "10px 16px", fontSize: 14, fontWeight: 600,
            cursor: /^0x[a-fA-F0-9]{40}$/.test(addr) ? "pointer" : "default",
          }}
        >Load</button>
        {wallet.available && !wallet.addr && (
          <button
            onClick={wallet.connect}
            style={{
              background: "transparent", color: "var(--yn-accent)",
              border: "1px solid var(--yn-accent)", borderRadius: 8,
              padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >Connect Wallet</button>
        )}
        {wallet.addr && (
          <button
            onClick={() => { wallet.disconnect(); setAddr(""); }}
            style={{
              background: "transparent", color: "var(--yn-text-dim)",
              border: "1px solid var(--yn-border)", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, cursor: "pointer",
            }}
            title={wallet.addr}
          >Disconnect {wallet.addr.slice(0, 6)}…{wallet.addr.slice(-4)}</button>
        )}
        {!wallet.available && (
          <span className="yn-placeholder" style={{ fontSize: 12 }}>
            install MetaMask to use Connect Wallet
          </span>
        )}
      </div>
      {wallet.error && <p className="yn-placeholder">wallet: {wallet.error}</p>}

      {activity.status === "idle" && (
        <p className="yn-placeholder" style={{ marginTop: 16 }}>
          Try one from the Earn page's top depositors — e.g. paste the full address of a row there.
        </p>
      )}

      {activity.status === "loading" && <p className="yn-placeholder">loading…</p>}
      {activity.status === "error" && <p className="yn-placeholder">error: {activity.message}</p>}

      {activity.status === "ok" && summary && (
        <>
          <div className="yn-grid" style={{ marginTop: 24 }}>
            <div className="yn-card">
              <h3>Assets deposited</h3>
              <div className="big">{summary.deposited.toFixed(4)}</div>
              <div className="sub">summed across Ethereum vaults</div>
            </div>
            <div className="yn-card">
              <h3>Assets withdrawn</h3>
              <div className="big">{summary.withdrawn.toFixed(4)}</div>
              <div className="sub">via Withdraw events</div>
            </div>
            <div className="yn-card">
              <h3>Transfers (in / out)</h3>
              <div className="big">{summary.inflows} · {summary.outflows}</div>
              <div className="sub">ynToken movements</div>
            </div>
            <div className="yn-card">
              <h3>Total events</h3>
              <div className="big">{summary.events}</div>
              <div className="sub">indexed by Willow</div>
            </div>
          </div>

          {summary.events === 0 && (
            <p className="yn-placeholder" style={{ marginTop: 24 }}>
              No YieldNest activity found for this address in indexed blocks yet.
            </p>
          )}

          {activity.data.deposits.length > 0 && (
            <>
              <h2 style={{ marginTop: 32, fontSize: 18 }}>Deposits</h2>
              <table className="yn-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr><th>Block</th><th>Caller</th><th>Assets in</th><th>Shares out</th><th>Proof</th></tr>
                </thead>
                <tbody>
                  {activity.data.deposits
                    .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
                    .map(d => (
                      <tr key={d.id}>
                        <td>{d.blockNumber}</td>
                        <td><CopyAddress addr={d.caller} /></td>
                        <td>{fmtAssets(d.assets)}</td>
                        <td>{fmtAssets(d.shares)}</td>
                        <td><ProofBadge subgrove="yieldnest-vaults-eth" entityType="deposit" entityId={d.id} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}

          {activity.data.withdraws.length > 0 && (
            <>
              <h2 style={{ marginTop: 32, fontSize: 18 }}>Withdrawals</h2>
              <table className="yn-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr><th>Block</th><th>Receiver</th><th>Assets out</th><th>Shares burned</th><th>Proof</th></tr>
                </thead>
                <tbody>
                  {activity.data.withdraws
                    .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
                    .map(w => (
                      <tr key={w.id}>
                        <td>{w.blockNumber}</td>
                        <td><CopyAddress addr={w.receiver} /></td>
                        <td>{fmtAssets(w.assets)}</td>
                        <td>{fmtAssets(w.shares)}</td>
                        <td><ProofBadge subgrove="yieldnest-vaults-eth" entityType="withdraw" entityId={w.id} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  );
}
