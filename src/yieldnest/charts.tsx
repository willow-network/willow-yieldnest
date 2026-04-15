import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { Deposit, assetsNumberHeuristic } from "./useDeposits";

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

/** Cumulative assets deposited over time. */
export function CumulativeTvlChart({ deposits }: { deposits: Deposit[] }) {
  const sorted = [...deposits].sort(
    (a, b) => Number(a.blockNumber) - Number(b.blockNumber),
  );
  let cum = 0;
  const data = sorted.map(d => {
    cum += assetsNumberHeuristic(d);
    return { block: Number(d.blockNumber), cumulative: Number(cum.toFixed(4)) };
  });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="block" stroke="var(--yn-text-dim)" fontSize={11}
               tickFormatter={(v) => v.toLocaleString()} />
        <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Block ${Number(v).toLocaleString()}`} />
        <Line type="monotone" dataKey="cumulative" stroke={GREEN} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Deposits per 200-block bucket. */
export function DepositVolumeChart({ deposits }: { deposits: Deposit[] }) {
  const BUCKET = 200;
  const byBucket = new Map<number, number>();
  for (const d of deposits) {
    const b = Math.floor(Number(d.blockNumber) / BUCKET) * BUCKET;
    byBucket.set(b, (byBucket.get(b) ?? 0) + assetsNumberHeuristic(d));
  }
  const data = [...byBucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, total]) => ({ bucket, total: Number(total.toFixed(4)) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" stroke="var(--yn-text-dim)" fontSize={11}
               tickFormatter={(v) => v.toLocaleString()} />
        <YAxis stroke="var(--yn-text-dim)" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Block bucket ${Number(v).toLocaleString()}`} />
        <Bar dataKey="total" fill={GREEN} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Top depositors by summed asset value. */
export function TopDepositorsChart({ deposits }: { deposits: Deposit[] }) {
  const byOwner = new Map<string, number>();
  for (const d of deposits) {
    if (!d.owner) continue;
    byOwner.set(d.owner, (byOwner.get(d.owner) ?? 0) + assetsNumberHeuristic(d));
  }
  const data = [...byOwner.entries()]
    .map(([owner, total]) => ({
      owner: `${owner.slice(0, 6)}…${owner.slice(-4)}`,
      total: Number(total.toFixed(4)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 70, bottom: 0 }}>
        <CartesianGrid stroke="var(--yn-border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="var(--yn-text-dim)" fontSize={11} />
        <YAxis type="category" dataKey="owner" stroke="var(--yn-text-dim)" fontSize={11} width={90} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="total" fill={GREEN_DARK} />
      </BarChart>
    </ResponsiveContainer>
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
