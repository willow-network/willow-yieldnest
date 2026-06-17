import { SubgroveStatus } from "../yieldnest/SubgroveStatus";
import { SampleProofBadge } from "../yieldnest/SampleProofBadge";
import { useVerify } from "../yieldnest/Verify";
import { ProofLoader } from "../yieldnest/ProofLoader";
import { CopyAddress } from "../yieldnest/CopyAddress";
import { useEffect, useState } from "react";
import { useChartColors } from "../yieldnest/chartColors";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";

type Transfer = { id: string; from: string; to: string; value: string; blockNumber: string };
type StakedUpdate = { id: string; totalETHStaked: string; blockNumber: string };

type Data = { transfers: Transfer[]; staked: StakedUpdate[] };

type State =
  | { status: "loading" }
  | { status: "ok"; data: Data }
  | { status: "error"; message: string };

const PAGE_SIZE = 300;

function useRestakingData(): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setS({ status: "loading" });
    const tick = async () => {
      // Two subgroves feed this page:
      //   - vaults-eth: ynETH/ynLSDe/ynETHx/ynUSDx/ynRWAx Transfer events —
      //     populates the volume/sender tables (the actual restaking-share
      //     movements users care about)
      //   - restaking-eth: StakingNodesManager TotalETHStakedUpdated —
      //     authoritative ETH-currently-staked snapshot, drives the chart
      //
      // RewardsProcessed/EthWithdrawn from the restaking subgrove are
      // intentionally omitted: the contracts emit zero-value harvest
      // sweeps frequently and would just noise up the tables.
      try {
        const [vaults, restaking] = await Promise.all([
          runQuery<{ transfers: Transfer[] }>(
            "yieldnest-vaults-eth",
            `{ transfers(first: 400, orderBy: blockNumber, orderDirection: desc) { id from to value blockNumber } }`,
          ).catch(e => {
            if (e instanceof NoIndexingProgressError) return { transfers: [] };
            throw e;
          }),
          runQuery<{ totalETHStakedUpdateds: StakedUpdate[] }>(
            "yieldnest-restaking-eth",
            `{ totalETHStakedUpdateds(first: ${PAGE_SIZE}) { id totalETHStaked blockNumber } }`,
          ).catch(e => {
            if (e instanceof NoIndexingProgressError) return { totalETHStakedUpdateds: [] };
            throw e;
          }),
        ]);
        if (!alive) return;
        setS({
          status: "ok",
          data: {
            transfers: vaults.transfers ?? [],
            staked: restaking.totalETHStakedUpdateds ?? [],
          },
        });
      } catch (e) {
        if (!alive) return;
        setS({ status: "error", message: String(e) });
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return s;
}

function weiToEth(s: string): number {
  try { return Number(BigInt(s)) / 1e18; } catch { return 0; }
}

export function Restaking() {
  const s = useRestakingData();
  const xfers = s.status === "ok" ? s.data.transfers : [];
  const staked = s.status === "ok" ? s.data.staked : [];
  const { verify } = useVerify();
  const cc = useChartColors();

  const uniqueAddrs = new Set<string>();
  for (const t of xfers) { uniqueAddrs.add(t.from); uniqueAddrs.add(t.to); }

  const sortedXfers = [...xfers].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
  let cum = 0;
  const cumData = sortedXfers.map(t => {
    cum += weiToEth(t.value);
    return { block: Number(t.blockNumber), cumulative: Number(cum.toFixed(4)), id: t.id };
  });

  const latestTotalStakedEth = (() => {
    if (staked.length === 0) return 0;
    const sorted = [...staked].sort(
      (a, b) => Number(b.blockNumber) - Number(a.blockNumber),
    );
    return weiToEth(sorted[0].totalETHStaked);
  })();

  const stakedSeries = [...staked]
    .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber))
    .map(u => ({
      id: u.id,
      block: Number(u.blockNumber),
      totalETHStaked: Number(weiToEth(u.totalETHStaked).toFixed(4)),
    }));

  const topSenders = Object.entries(
    xfers.reduce<Record<string, number>>((acc, t) => {
      acc[t.from] = (acc[t.from] ?? 0) + weiToEth(t.value);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Restaking</h1>
      <p><SubgroveStatus id={["yieldnest-restaking-eth", "yieldnest-vaults-eth"]} /></p>
      <p className="yn-placeholder">
        Native ETH staked across YieldNest's StakingNodesManager (authoritative
        snapshot) plus restaking-share movements on vault tokens (ynETH, ynLSDe,
        ynETHx, ynUSDx, ynRWAx) — both decoded from Ethereum mainnet by Willow.
      </p>

      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card">
          <h3>Total ETH staked</h3>
          <div className="big">{s.status === "ok" ? latestTotalStakedEth.toFixed(2) : "—"}</div>
          <div className="sub">latest StakingNodesManager snapshot</div>
        </div>
        <div className="yn-card">
          <h3>Share transfers</h3>
          <div className="big">{s.status === "ok" ? xfers.length.toLocaleString() : "—"}</div>
          <div className="sub">on yn* vault tokens</div>
        </div>
        <div className="yn-card">
          <h3>Unique addresses</h3>
          <div className="big">{uniqueAddrs.size}</div>
          <div className="sub">either side of a transfer</div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Total ETH staked over time</h3>
          <div className="sub" style={{ marginBottom: 12 }}>each point is a TotalETHStakedUpdated emission</div>
          {s.status === "ok" && stakedSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stakedSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} style={{ cursor: "pointer" }}>
                <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
                       tickFormatter={(v) => v.toLocaleString()} />
                <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "var(--yn-surface)", border: "1px solid var(--yn-border)", borderRadius: 8, color: "var(--yn-text)", fontSize: 12 }}
                  labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`}
                />
                <Line type="monotone" dataKey="totalETHStaked" stroke={cc.green} strokeWidth={2} dot={false}
                  activeDot={{ r: 5, onClick: (_e: any, pl: any) => { const id = pl?.payload?.id; if (id) verify({ subgrove: "yieldnest-restaking-eth", entityType: "totalETHStakedUpdated", entityId: id }); } }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            s.status === "loading" ? <ProofLoader /> : <p className="yn-placeholder">no staking-update events yet</p>
          )}
          <div style={{ marginTop: 10 }}>
            <SampleProofBadge subgrove="yieldnest-restaking-eth" entityTypes={["totalETHStakedUpdated"]} />
          </div>
        </div>

        <div className="yn-card">
          <h3>Cumulative share-transfer volume</h3>
          <div className="sub" style={{ marginBottom: 12 }}>summed transfer value over block height</div>
          {s.status === "ok" && cumData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cumData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} style={{ cursor: "pointer" }}>
                <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
                       tickFormatter={(v) => v.toLocaleString()} />
                <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "var(--yn-surface)", border: "1px solid var(--yn-border)", borderRadius: 8, color: "var(--yn-text)", fontSize: 12 }}
                  labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`}
                />
                <Line type="monotone" dataKey="cumulative" stroke={cc.green} strokeWidth={2} dot={false}
                  activeDot={{ r: 5, onClick: (_e: any, pl: any) => { const id = pl?.payload?.id; if (id) verify({ subgrove: "yieldnest-vaults-eth", entityType: "transfer", entityId: id }); } }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            s.status === "loading" ? <ProofLoader /> : <p className="yn-placeholder">no transfer events yet</p>
          )}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>
      </div>

      <div className="yn-card" style={{ marginTop: 24 }}>
        <h3>Largest senders</h3>
        <div className="sub" style={{ marginBottom: 12 }}>top 5 addresses by share-token outflow</div>
        {topSenders.length === 0 ? (
          s.status === "loading" ? <ProofLoader /> : <p className="yn-placeholder">no data yet</p>
        ) : (
          <table className="yn-table">
            <thead><tr><th>Address</th><th>Volume</th><th>Proof</th></tr></thead>
            <tbody>
              {topSenders.map(([addr, vol]) => (
                <tr key={addr}>
                  <td><CopyAddress addr={addr} /></td>
                  <td>{vol.toFixed(4)}</td>
                  <td><SampleProofBadge subgrove="yieldnest-vaults-eth" entityTypes={["transfer"]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
