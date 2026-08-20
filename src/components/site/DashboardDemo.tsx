import { useMemo, useState } from "react";
import {
  branches,
  groups,
  RANGES,
  sales,
  type Branch,
  type Group,
  type RangeId,
} from "@/data/demo-dashboard";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * A dashboard that actually answers questions.
 *
 * The point of buying a dashboard is not the chart — it is being able to ask
 * "what about only Vijayawada, only spares, only last month" and get an answer
 * in a second. So every control here re-filters the real 12-month dataset and
 * every number on screen recomputes, including the comparison against the
 * preceding period. Nothing is pre-baked.
 */

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Compact form for axis labels and tight cards. */
function short(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${Math.round(n / 1e3)}k`;
  return `₹${Math.round(n)}`;
}

export function DashboardDemo() {
  const [range, setRange] = useState<RangeId>("90");
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [group, setGroup] = useState<Group | "All">("All");

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    const today = new Date();
    const startMs = today.getTime() - days * 86400000;
    const prevStartMs = startMs - days * 86400000;

    const matches = (s: (typeof sales)[number]) =>
      (branch === "All" || s.branch === branch) && (group === "All" || s.group === group);

    let revenue = 0,
      units = 0,
      margin = 0,
      orders = 0;
    let prevRevenue = 0;
    const byDay = new Map<string, number>();
    const byBranch = new Map<string, number>();
    const byGroup = new Map<string, number>();

    for (const s of sales) {
      if (!matches(s)) continue;
      const t = new Date(s.d + "T00:00:00").getTime();
      if (t >= startMs) {
        revenue += s.revenue;
        units += s.units;
        margin += s.margin;
        orders += 1;
        byDay.set(s.d, (byDay.get(s.d) ?? 0) + s.revenue);
        byBranch.set(s.branch, (byBranch.get(s.branch) ?? 0) + s.revenue);
        byGroup.set(s.group, (byGroup.get(s.group) ?? 0) + s.revenue);
      } else if (t >= prevStartMs) {
        prevRevenue += s.revenue;
      }
    }

    // Long ranges get bucketed by month, or the line turns into noise.
    const series = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    const bucketed =
      days > 120
        ? [
            ...series
              .reduce(
                (m, [d, v]) => m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) ?? 0) + v),
                new Map<string, number>(),
              )
              .entries(),
          ]
        : series;

    return {
      revenue,
      units,
      margin,
      orders,
      delta: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null,
      avgOrder: orders ? revenue / orders : 0,
      series: bucketed,
      byBranch: [...byBranch.entries()].sort((a, b) => b[1] - a[1]),
      byGroup: [...byGroup.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [range, branch, group]);

  // Tracking sits in the handlers, not in a state updater — inside one,
  // StrictMode's double invocation fires every event twice.
  const onFilter = (kind: string) => track({ name: "demo_opened", demo: `dashboard-${kind}` });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <Control label="Period">
          <Segmented
            options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
            value={range}
            onChange={(v) => {
              setRange(v as RangeId);
              onFilter("range");
            }}
          />
        </Control>
        <Control label="Branch">
          <Select
            value={branch}
            options={["All", ...branches]}
            onChange={(v) => {
              setBranch(v as Branch | "All");
              onFilter("branch");
            }}
          />
        </Control>
        <Control label="Product group">
          <Select
            value={group}
            options={["All", ...groups]}
            onChange={(v) => {
              setGroup(v as Group | "All");
              onFilter("group");
            }}
          />
        </Control>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={inr(view.revenue)} delta={view.delta} />
        <Kpi
          label="Gross margin"
          value={inr(view.margin)}
          sub={
            view.revenue ? `${((view.margin / view.revenue) * 100).toFixed(1)}% of revenue` : "—"
          }
        />
        <Kpi
          label="Orders"
          value={view.orders.toLocaleString("en-IN")}
          sub={`${view.units.toLocaleString("en-IN")} units`}
        />
        <Kpi label="Average order" value={inr(view.avgOrder)} sub="per invoice" />
      </div>

      {/* Trend */}
      <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-sm font-semibold">
          Revenue trend
          <span className="ml-2 font-normal text-muted-foreground">
            {branch === "All" ? "all branches" : branch} · {group === "All" ? "all groups" : group}
          </span>
        </p>
        <Trend points={view.series} />
      </div>

      {/* Breakdowns */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="By branch"
          rows={view.byBranch}
          total={view.revenue}
          onPick={(name) => {
            setBranch(name as Branch);
            onFilter("branch");
          }}
          active={branch}
        />
        <Breakdown
          title="By product group"
          rows={view.byGroup}
          total={view.revenue}
          onPick={(name) => {
            setGroup(name as Group);
            onFilter("group");
          }}
          active={group}
        />
      </div>

      {view.orders === 0 ? (
        <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-center text-sm text-muted-foreground">
          No sales match that combination — widen the period or clear a filter.
        </p>
      ) : null}
    </div>
  );
}

/* ---------- pieces ---------- */

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-medium"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "All" ? "All" : o}
        </option>
      ))}
    </select>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  delta?: number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none font-semibold">{value}</p>
      {delta != null ? (
        <p
          className={cn(
            "mt-1.5 text-xs font-semibold",
            delta >= 0
              ? "text-[#0B7A4B] dark:text-[#4FD99B]"
              : "text-[#C9313A] dark:text-[#FF8A8A]",
          )}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs previous period
        </p>
      ) : sub ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

function Trend({ points }: { points: [string, number][] }) {
  if (points.length < 2) {
    return <p className="mt-4 text-sm text-muted-foreground">Not enough data in this range.</p>;
  }
  const W = 800,
    H = 170,
    PAD = 8;
  const max = Math.max(...points.map((p) => p[1]));
  const step = (W - PAD * 2) / (points.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = points.map((p, i) => `${PAD + i * step},${y(p[1])}`).join(" ");

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenue over the selected period"
      >
        <polygon
          points={`${line} ${W - PAD},${H} ${PAD},${H}`}
          fill="var(--signal)"
          opacity="0.12"
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--signal)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{points[0]![0]}</span>
        <span>peak {short(max)}</span>
        <span>{points[points.length - 1]![0]}</span>
      </div>
    </>
  );
}

function Breakdown({
  title,
  rows,
  total,
  onPick,
  active,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  onPick: (name: string) => void;
  active: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Click a row to filter the whole dashboard.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map(([name, value]) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            className={cn(
              "group text-left transition-opacity",
              active !== "All" && active !== name && "opacity-55 hover:opacity-100",
            )}
          >
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">{name}</span>
              <span className="font-mono text-muted-foreground">{short(value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-signal transition-[width] duration-500"
                style={{ width: total ? `${(value / total) * 100}%` : "0%" }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
