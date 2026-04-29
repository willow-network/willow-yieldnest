import { SubgroveStatus } from "../yieldnest/SubgroveStatus";
import { SampleProofBadge } from "../yieldnest/SampleProofBadge";
import { CopyAddress } from "../yieldnest/CopyAddress";
import { useEffect, useState } from "react";
import { runQuery, NoIndexingProgressError } from "../yieldnest/graphql";
import { PageSizeSelector, DEFAULT_PAGE_SIZE, type PageSize } from "../yieldnest/PageSize";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";

type StakedUpdate = { id: string; totalETHStaked: string; blockNumber: string };
type RewardsProcessed = {
  id: string; totalRewards: string; elRewards: string; clRewards: string;
  netRewards: string; fees: string; blockNumber: string;
};
type EthWithdrawn = { id: string; to: string; amount: string; blockNumber: string };

type Data = {
  staked: StakedUpdate[];
  rewards: RewardsProcessed[];
  withdrawals: EthWithdrawn[];
};

type RawData = {
  totalETHStakedUpdateds?: StakedUpdate[];
  rewardsProcesseds?: RewardsProcessed[];
  ethWithdrawns?: EthWithdrawn[];
};

type State =
  | { status: "loading" }
  | { status: "ok"; data: Data }
  | { status: "error"; message: string };

function useRestakingData(pageSize: PageSize): State {
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setS({ status: "loading" });
    const tick = async () => {
      try {
        const q = `{
          totalETHStakedUpdateds(first: ${pageSize}) { id totalETHStaked blockNumber }
          rewardsProcesseds(first: ${pageSize}) { id totalRewards elRewards clRewards netRewards fees blockNumber }
          ethWithdrawns(first: ${pageSize}) { id to amount blockNumber }
        }`;
        const d = await runQuery<RawData>("yieldnest-restaking-eth", q);
        if (!alive) return;
        setS({
          status: "ok",
          data: {
            staked: d.totalETHStakedUpdateds ?? [],
            rewards: d.rewardsProcesseds ?? [],
            withdrawals: d.ethWithdrawns ?? [],
          },
        });
      } catch (e) {
        if (!alive) return;
        if (e instanceof NoIndexingProgressError) {
          setS({ status: "ok", data: { staked: [], rewards: [], withdrawals: [] } });
        } else {
          setS({ status: "error", message: String(e) });
        }
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); };
  }, [pageSize]);
  return s;
}

function weiToEth(s: string): number {
  try { return Number(BigInt(s)) / 1e18; } catch { return 0; }
}

export function Restaking() {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const s = useRestakingData(pageSize);
  const data = s.status === "ok" ? s.data : { staked: [], rewards: [], withdrawals: [] };

  const latestTotalStakedEth = (() => {
    if (data.staked.length === 0) return 0;
    const sorted = [...data.staked].sort(
      (a, b) => Number(b.blockNumber) - Number(a.blockNumber),
    );
    return weiToEth(sorted[0].totalETHStaked);
  })();

  const totalRewardsEth = data.rewards.reduce((n, r) => n + weiToEth(r.totalRewards), 0);
  const totalWithdrawnEth = data.withdrawals.reduce((n, w) => n + weiToEth(w.amount), 0);

  const stakedSeries = [...data.staked]
    .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber))
    .map(u => ({
      block: Number(u.blockNumber),
      totalETHStaked: Number(weiToEth(u.totalETHStaked).toFixed(4)),
    }));

  const recentRewards = [...data.rewards]
    .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
    .slice(0, 5);

  const recentWithdrawals = [...data.withdrawals]
    .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
    .slice(0, 5);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0 }}>Restaking</h1>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>
      <p><SubgroveStatus id="yieldnest-restaking-eth" /></p>
      <p className="yn-placeholder">
        Native ETH restaking activity from YieldNest's StakingNodesManager,
        RewardsDistributor, and EigenLayer/Consensus reward receivers — decoded
        by Willow from Ethereum mainnet.
      </p>

      <div className="yn-grid" style={{ marginTop: 24 }}>
        <div className="yn-card">
          <h3>Total ETH staked</h3>
          <div className="big">{s.status === "ok" ? latestTotalStakedEth.toFixed(2) : "—"}</div>
          <div className="sub">latest snapshot from StakingNodesManager</div>
        </div>
        <div className="yn-card">
          <h3>Rewards processed</h3>
          <div className="big">{s.status === "ok" ? data.rewards.length.toLocaleString() : "—"}</div>
          <div className="sub">{totalRewardsEth.toFixed(4)} ETH distributed</div>
        </div>
        <div className="yn-card">
          <h3>Withdrawals</h3>
          <div className="big">{s.status === "ok" ? data.withdrawals.length.toLocaleString() : "—"}</div>
          <div className="sub">{totalWithdrawnEth.toFixed(4)} ETH withdrawn</div>
        </div>
      </div>

      <div className="yn-grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        <div className="yn-card">
          <h3>Total ETH staked over time</h3>
          <div className="sub" style={{ marginBottom: 12 }}>each point is a TotalETHStakedUpdated emission</div>
          {s.status === "ok" && stakedSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stakedSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
                       tickFormatter={(v) => v.toLocaleString()} />
                <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "var(--yn-surface)", border: "1px solid var(--yn-border)", borderRadius: 8, color: "var(--yn-text)", fontSize: 12 }}
                  labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`}
                />
                <Line type="monotone" dataKey="totalETHStaked" stroke="#4ea882" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="yn-placeholder">no staking-update events yet</p>
          )}
          <div style={{ marginTop: 10 }}><span className="yn-proof-badge">Willow verified</span></div>
        </div>

        <div className="yn-card">
          <h3>Recent rewards distributions</h3>
          <div className="sub" style={{ marginBottom: 12 }}>RewardsProcessed: EL + CL split, fees taken</div>
          {recentRewards.length === 0 ? (
            <p className="yn-placeholder">no rewards events yet</p>
          ) : (
            <table className="yn-table">
              <thead><tr><th>Block</th><th>Total</th><th>EL</th><th>CL</th><th>Fees</th><th>Proof</th></tr></thead>
              <tbody>
                {recentRewards.map(r => (
                  <tr key={r.id}>
                    <td>{Number(r.blockNumber).toLocaleString()}</td>
                    <td>{weiToEth(r.totalRewards).toFixed(4)}</td>
                    <td>{weiToEth(r.elRewards).toFixed(4)}</td>
                    <td>{weiToEth(r.clRewards).toFixed(4)}</td>
                    <td>{weiToEth(r.fees).toFixed(4)}</td>
                    <td><SampleProofBadge subgrove="yieldnest-restaking-eth" entityTypes={["rewardsProcessed"]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="yn-card" style={{ marginTop: 24 }}>
        <h3>Recent withdrawals</h3>
        <div className="sub" style={{ marginBottom: 12 }}>EthWithdrawn from EigenLayer / Consensus receivers</div>
        {recentWithdrawals.length === 0 ? (
          <p className="yn-placeholder">no withdrawal events yet</p>
        ) : (
          <table className="yn-table">
            <thead><tr><th>Block</th><th>To</th><th>Amount (ETH)</th><th>Proof</th></tr></thead>
            <tbody>
              {recentWithdrawals.map(w => (
                <tr key={w.id}>
                  <td>{Number(w.blockNumber).toLocaleString()}</td>
                  <td><CopyAddress addr={w.to} /></td>
                  <td>{weiToEth(w.amount).toFixed(4)}</td>
                  <td><SampleProofBadge subgrove="yieldnest-restaking-eth" entityTypes={["ethWithdrawn"]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
