import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { Deposit, assetsNumberHeuristic } from "./useDeposits";
import { useVerify } from "./Verify";

const GREEN = "#4ea882";
const GREEN_DARK = "#2c7a5c";
const GREEN_LIGHT = "#7acba7";
const PALETTE = [GREEN, GREEN_DARK, GREEN_LIGHT, "#b45309", "#5a6b60", "#c5d6ca"];

const tooltipStyle = {
  background: "var(--yn-surface)",
  border: "1px solid var(--yn-border)",
  borderRadius: 8,
  color: "var(--yn-text)",
  fontSize: 12,
};

// Wraps a chart so the whole plot area shows a pointer + a "click to verify"
// hint; the chart's onClick verifies the entity behind the active point.
function Clickable({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div style={{ cursor: "pointer" }} title={hint}>
      {children}
    </div>
  );
}

/** Cumulative assets deposited over time — each point is one deposit. */
export function CumulativeTvlChart({ deposits, subgrove = "yieldnest-vaults-eth" }: { deposits: Deposit[]; subgrove?: string }) {
  const { verify } = useVerify();
  const sorted = [...deposits].sort(
    (a, b) => Number(a.blockNumber) - Number(b.blockNumber),
  );
  let cum = 0;
  const data = sorted.map(d => {
    cum += assetsNumberHeuristic(d);
    return { block: Number(d.blockNumber), cumulative: Number(cum.toFixed(4)), id: d.id };
  });
  return (
    <Clickable hint="Click a point to verify that deposit's proof">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
                 tickFormatter={(v) => v.toLocaleString()} />
          <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`} />
          <Line type="monotone" dataKey="cumulative" stroke={GREEN} strokeWidth={2} dot={false}
            activeDot={{ r: 5, onClick: (_e: any, pl: any) => { const id = pl?.payload?.id; if (id) verify({ subgrove, entityType: "deposit", entityId: id }); } }} />
        </LineChart>
      </ResponsiveContainer>
    </Clickable>
  );
}

/** Deposits per 200-block bucket — click a bar to verify a deposit from it. */
export function DepositVolumeChart({ deposits, subgrove = "yieldnest-vaults-eth" }: { deposits: Deposit[]; subgrove?: string }) {
  const { verify } = useVerify();
  const BUCKET = 200;
  const byBucket = new Map<number, { total: number; id: string }>();
  for (const d of deposits) {
    const b = Math.floor(Number(d.blockNumber) / BUCKET) * BUCKET;
    const cur = byBucket.get(b);
    byBucket.set(b, { total: (cur?.total ?? 0) + assetsNumberHeuristic(d), id: cur?.id ?? d.id });
  }
  const data = [...byBucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, v]) => ({ bucket, total: Number(v.total.toFixed(4)), id: v.id }));
  return (
    <Clickable hint="Click a bar to verify a deposit from that block range">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" stroke="var(--yn-text-dim)" fontSize={11}
                 tickFormatter={(v) => v.toLocaleString()} />
          <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Block bucket ${Number(v).toLocaleString()}`} />
          <Bar dataKey="total" fill={GREEN} onClick={(d: any) => { const id = d?.payload?.id; if (id) verify({ subgrove, entityType: "deposit", entityId: id }); }} />
        </BarChart>
      </ResponsiveContainer>
    </Clickable>
  );
}

/** Top depositors by summed value — click a bar to verify one of their deposits. */
export function TopDepositorsChart({ deposits, subgrove = "yieldnest-vaults-eth" }: { deposits: Deposit[]; subgrove?: string }) {
  const { verify } = useVerify();
  const byOwner = new Map<string, { total: number; id: string }>();
  for (const d of deposits) {
    if (!d.owner) continue;
    const cur = byOwner.get(d.owner);
    byOwner.set(d.owner, { total: (cur?.total ?? 0) + assetsNumberHeuristic(d), id: cur?.id ?? d.id });
  }
  const data = [...byOwner.entries()]
    .map(([owner, v]) => ({
      owner: `${owner.slice(0, 6)}…${owner.slice(-4)}`,
      total: Number(v.total.toFixed(4)),
      id: v.id,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  return (
    <Clickable hint="Click a bar to verify a deposit from that address">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 70, bottom: 0 }}>
          <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke="var(--yn-text-dim)" fontSize={11} />
          <YAxis type="category" dataKey="owner" stroke="var(--yn-text-dim)" fontSize={11} width={90} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="total" fill={GREEN_DARK} onClick={(d: any) => { const id = d?.payload?.id; if (id) verify({ subgrove, entityType: "deposit", entityId: id }); }} />
        </BarChart>
      </ResponsiveContainer>
    </Clickable>
  );
}

/** Donut showing per-subgrove entity share. */
export function SubgroveShareChart({
  slices,
}: {
  slices: Array<{ name: string; value: number }>;
}) {
  const nonzero = slices.filter(s => s.value > 0);
  if (nonzero.length === 0) {
    return <p className="yn-placeholder">no entities indexed yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={nonzero} dataKey="value" nameKey="name"
          cx="50%" cy="50%" innerRadius={55} outerRadius={95}
          stroke="var(--yn-surface)" strokeWidth={2}
        >
          {nonzero.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--yn-text)" }} />
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
