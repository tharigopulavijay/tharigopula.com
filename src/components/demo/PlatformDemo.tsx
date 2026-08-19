import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  businesses,
  businessBySlug,
  inr,
  inrShort,
  lowStock,
  type BusinessProfile,
  type Job,
  type Lead,
} from "@/data/demo-platform";

/**
 * PlatformDemo — a working business platform a visitor can click through.
 *
 * The point of this component is the business switcher: the same screens
 * re-populate with a manufacturer's dealers and orders, or a clinic's patients
 * and appointments. A visitor sees their own business running, not ours.
 */

type ModuleKey = "dashboard" | "pipeline" | "inventory" | "billing" | "service" | "automation";

const MODULES: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <IconGrid /> },
  { key: "pipeline", label: "Pipeline", icon: <IconFlow /> },
  { key: "inventory", label: "Inventory", icon: <IconBox /> },
  { key: "billing", label: "Billing", icon: <IconBill /> },
  { key: "service", label: "Service", icon: <IconWrench /> },
  { key: "automation", label: "Automation", icon: <IconBolt /> },
];

export function PlatformDemo({
  initialBusiness,
  onBusinessChange,
}: {
  /** Opens the demo already showing this business — used for industry deep links. */
  initialBusiness?: string | undefined;
  /** Lets the page keep its copy and CTAs in step with the demo. */
  onBusinessChange?: ((slug: string) => void) | undefined;
} = {}) {
  const [slug, setSlug] = useState(
    initialBusiness && businesses.some((b) => b.slug === initialBusiness)
      ? initialBusiness
      : businesses[0]!.slug,
  );
  const [module, setModule] = useState<ModuleKey>("dashboard");
  const business = businessBySlug(slug);

  // Leads live in state so the pipeline is actually interactive.
  const [leads, setLeads] = useState<Lead[]>(business.leads);
  useEffect(() => setLeads(businessBySlug(slug).leads), [slug]);

  const [flash, setFlash] = useState(false);
  const switchBusiness = (next: string) => {
    track({ name: "demo_industry_changed", from: slug, to: next });
    setSlug(next);
    onBusinessChange?.(next);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 420);
  };

  const openModule = (next: ModuleKey) => {
    track({ name: "demo_module_viewed", module: next, business: slug });
    if (next === "automation") track({ name: "automation_demo_started", business: slug });
    setModule(next);
  };

  return (
    <div
      className="tg-demo overflow-hidden rounded-xl border"
      style={
        {
          "--d-bg": "#070E1B",
          "--d-panel": "#0C1626",
          "--d-raise": "#111E33",
          "--d-line": "#1C2E4A",
          "--d-text": "#E8EFFA",
          "--d-muted": "#7D93B5",
          "--d-accent": business.accent,
          background: "var(--d-bg)",
          borderColor: "var(--d-line)",
          color: "var(--d-text)",
          fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      {/* ---------- business switcher ---------- */}
      <div
        className="border-b px-4 py-3 sm:px-5"
        style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
      >
        <p
          className="mb-2.5 font-mono text-[10px] tracking-[0.2em] uppercase"
          style={{ color: "var(--d-muted)" }}
        >
          Choose a business — every screen below changes with it
        </p>
        <div className="flex flex-wrap gap-1.5">
          {businesses.map((b) => {
            const on = b.slug === slug;
            return (
              <button
                key={b.slug}
                type="button"
                onClick={() => switchBusiness(b.slug)}
                aria-pressed={on}
                className="rounded-md border px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: on ? b.accent : "var(--d-line)",
                  background: on ? `${b.accent}1F` : "transparent",
                  color: on ? b.accent : "var(--d-muted)",
                }}
              >
                {b.industry}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* ---------- sidebar ---------- */}
        <aside
          className="shrink-0 border-b sm:w-[190px] sm:border-r sm:border-b-0"
          style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
        >
          <div className="flex items-center gap-2.5 px-4 py-4">
            <div
              className="grid h-8 w-8 place-items-center rounded-md text-[13px] font-bold"
              style={{ background: `${business.accent}26`, color: business.accent }}
            >
              {business.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] leading-tight font-semibold">{business.name}</p>
              <p className="truncate text-[10px]" style={{ color: "var(--d-muted)" }}>
                {business.location}
              </p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-2 pb-3 sm:flex-col sm:overflow-visible">
            {MODULES.map((m) => {
              const on = m.key === module;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => openModule(m.key)}
                  aria-current={on ? "page" : undefined}
                  className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors"
                  style={{
                    background: on ? `${business.accent}1F` : "transparent",
                    color: on ? business.accent : "var(--d-muted)",
                  }}
                >
                  <span className="opacity-90">{m.icon}</span>
                  {m.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ---------- main ---------- */}
        <main
          className="min-w-0 flex-1 p-4 sm:p-5"
          style={{
            transition: "opacity .32s ease",
            opacity: flash ? 0.25 : 1,
          }}
        >
          {module === "dashboard" && <Dashboard b={business} leads={leads} />}
          {module === "pipeline" && <Pipeline b={business} leads={leads} setLeads={setLeads} />}
          {module === "inventory" && <Inventory b={business} />}
          {module === "billing" && <Billing b={business} />}
          {module === "service" && <Service b={business} />}
          {module === "automation" && <Automation b={business} />}
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Shared bits                                                         */
/* ================================================================== */

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg border"
      style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--d-line)" }}
      >
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap"
      style={{ background: `${tone}1F`, color: tone, border: `1px solid ${tone}40` }}
    >
      {children}
    </span>
  );
}

const TONE = {
  good: "#10B981",
  warn: "#F59E0B",
  bad: "#EF4444",
  cool: "#38BDF8",
  mute: "#7D93B5",
};

const statusTone = (s: string) =>
  s === "Paid" || s === "Confirmed" || s === "Closed"
    ? TONE.good
    : s === "Overdue" || s === "High"
      ? TONE.bad
      : s === "Pending" || s === "Waiting" || s === "In progress" || s === "Medium"
        ? TONE.warn
        : TONE.mute;

/* ================================================================== */
/* Dashboard                                                           */
/* ================================================================== */

function Dashboard({ b, leads }: { b: BusinessProfile; leads: Lead[] }) {
  const max = Math.max(...b.revenue.map((r) => r.v));
  const totalCh = b.channels.reduce((s, c) => s + c.v, 0);
  const alerts = lowStock(b);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {b.kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg border p-3.5"
            style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
          >
            <p
              className="font-mono text-[10px] tracking-[0.14em] uppercase"
              style={{ color: "var(--d-muted)" }}
            >
              {k.label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{k.value}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px]">
              {k.delta !== 0 && (
                <span style={{ color: k.delta > 0 ? TONE.good : TONE.bad }}>
                  {k.delta > 0 ? "▲" : "▼"} {Math.abs(k.delta)}%
                </span>
              )}
              <span style={{ color: "var(--d-muted)" }}>{k.hint}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue"
          action={
            <span className="font-mono text-[10px]" style={{ color: "var(--d-muted)" }}>
              LAST 8 MONTHS
            </span>
          }
        >
          <div className="flex h-[168px] items-end gap-2">
            {b.revenue.map((r, i) => (
              <div key={r.m} className="group flex flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${(r.v / max) * 100}%`,
                      background:
                        i === b.revenue.length - 1
                          ? b.accent
                          : `linear-gradient(to top, ${b.accent}55, ${b.accent}22)`,
                    }}
                  />
                  <span
                    className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--d-text)" }}
                  >
                    {inrShort(r.v)}
                  </span>
                </div>
                <span className="font-mono text-[9px]" style={{ color: "var(--d-muted)" }}>
                  {r.m}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`Where ${b.terms.leads.toLowerCase()} come from`}>
          <div className="flex flex-col gap-3">
            {b.channels.map((c) => (
              <div key={c.label}>
                <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
                  <span>{c.label}</span>
                  <span className="font-mono tabular-nums" style={{ color: "var(--d-muted)" }}>
                    {c.v}%
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: "var(--d-raise)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(c.v / totalCh) * 100}%`, background: b.accent }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Recent ${b.terms.leads.toLowerCase()}`}>
          <ul className="flex flex-col gap-2.5">
            {leads.slice(0, 4).map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-[10px] font-bold"
                  style={{ background: `${b.accent}22`, color: b.accent }}
                >
                  {l.party.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{l.party}</span>
                  <span className="block truncate text-[10px]" style={{ color: "var(--d-muted)" }}>
                    {l.source} · {l.ageDays}d ago
                  </span>
                </span>
                <span className="font-mono text-[11px] tabular-nums">{inrShort(l.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={`${b.terms.stock} needing attention`}>
          {alerts.length ? (
            <ul className="flex flex-col gap-2.5">
              {alerts.map((c) => (
                <li key={c.sku} className="flex items-center gap-3">
                  <Chip tone={TONE.bad}>LOW</Chip>
                  <span className="min-w-0 flex-1 truncate text-[12px]">{c.name}</span>
                  <span className="font-mono text-[11px] tabular-nums" style={{ color: TONE.bad }}>
                    {c.stock}/{c.reorder}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
              Everything is above reorder level.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Pipeline — interactive kanban                                       */
/* ================================================================== */

function Pipeline({
  b,
  leads,
  setLeads,
}: {
  b: BusinessProfile;
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
}) {
  const [open, setOpen] = useState<Lead | null>(null);

  const move = (lead: Lead, dir: 1 | -1) => {
    const idx = b.stages.findIndex((s) => s.id === lead.stage);
    const next = b.stages[idx + dir];
    if (!next) return;
    setLeads(leads.map((l) => (l.id === lead.id ? { ...l, stage: next.id } : l)));
    setOpen(null);
  };

  const weighted = leads
    .filter(
      (l) =>
        !["lost", "dropped", "no-show", "closed", "completed"].some((x) => l.stage.includes(x)),
    )
    .reduce((s, l) => s + l.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{b.terms.lead} pipeline</h2>
          <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
            Click any card to move it forward — the totals update live.
          </p>
        </div>
        <div className="text-right">
          <p
            className="font-mono text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--d-muted)" }}
          >
            Open pipeline
          </p>
          <p className="text-xl font-bold tabular-nums" style={{ color: b.accent }}>
            {inrShort(weighted)}
          </p>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[880px] gap-3">
          {b.stages.map((s) => {
            const inStage = leads.filter((l) => l.stage === s.id);
            const total = inStage.reduce((sum, l) => sum + l.value, 0);
            const dead = s.tone === "lost";
            return (
              <div
                key={s.id}
                className="flex flex-1 flex-col rounded-lg border"
                style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
              >
                <header className="border-b px-3 py-2.5" style={{ borderColor: "var(--d-line)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold">{s.label}</span>
                    <span
                      className="rounded px-1.5 font-mono text-[10px] tabular-nums"
                      style={{ background: "var(--d-raise)", color: "var(--d-muted)" }}
                    >
                      {inStage.length}
                    </span>
                  </div>
                  <p
                    className="mt-1 font-mono text-[10px] tabular-nums"
                    style={{ color: dead ? "var(--d-muted)" : b.accent }}
                  >
                    {inrShort(total)}
                  </p>
                </header>

                <div className="flex flex-col gap-2 p-2">
                  {inStage.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setOpen(l)}
                      className="rounded-md border p-2.5 text-left transition-all hover:-translate-y-px"
                      style={{
                        borderColor: "var(--d-line)",
                        background: "var(--d-raise)",
                        opacity: dead ? 0.55 : 1,
                      }}
                    >
                      <p className="truncate text-[12px] font-medium">{l.party}</p>
                      <p
                        className="mt-0.5 truncate text-[10px]"
                        style={{ color: "var(--d-muted)" }}
                      >
                        {l.person}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] tabular-nums">
                          {inrShort(l.value)}
                        </span>
                        <span className="font-mono text-[9px]" style={{ color: "var(--d-muted)" }}>
                          {l.ageDays}d
                        </span>
                      </div>
                    </button>
                  ))}
                  {!inStage.length && (
                    <p
                      className="px-1 py-3 text-center text-[10px]"
                      style={{ color: "var(--d-muted)" }}
                    >
                      Empty
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: b.accent, background: "var(--d-panel)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px]" style={{ color: "var(--d-muted)" }}>
                {open.id} · via {open.source} · owner {open.owner}
              </p>
              <h3 className="mt-1 text-base font-semibold">{open.party}</h3>
              <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
                {open.person} · {open.phone}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="rounded px-2 py-1 text-[11px]"
              style={{ color: "var(--d-muted)", border: "1px solid var(--d-line)" }}
            >
              Close
            </button>
          </div>

          <p className="mt-3 rounded-md p-3 text-[12px]" style={{ background: "var(--d-raise)" }}>
            {open.note}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tabular-nums" style={{ color: b.accent }}>
              {inr(open.value)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => move(open, -1)}
              className="rounded-md border px-3 py-1.5 text-[11px] font-medium"
              style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
            >
              ← Move back
            </button>
            <button
              type="button"
              onClick={() => move(open, 1)}
              className="rounded-md px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: b.accent, color: "#06101F" }}
            >
              Move forward →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Inventory                                                           */
/* ================================================================== */

function Inventory({ b }: { b: BusinessProfile }) {
  const tracked = b.catalog.filter((c) => c.reorder > 0);
  const isService = tracked.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{b.terms.items}</h2>
        <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
          {isService
            ? "Service catalogue with rate card — no physical stock to track."
            : `Live ${b.terms.stock.toLowerCase()} position with automatic reorder alerts.`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--d-line)" }}>
        <table className="w-full min-w-[620px] border-collapse text-[12px]">
          <thead>
            <tr style={{ background: "var(--d-panel)" }}>
              {["Code", b.terms.item, "Group", "Rate", b.terms.stock, ""].map((h) => (
                <th
                  key={h}
                  className="border-b px-3 py-2.5 text-left font-mono text-[10px] tracking-[0.12em] uppercase"
                  style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.catalog.map((c) => {
              const low = c.reorder > 0 && c.stock < c.reorder;
              const pct = c.reorder > 0 ? Math.min(100, (c.stock / (c.reorder * 2)) * 100) : 100;
              return (
                <tr key={c.sku} style={{ background: "var(--d-bg)" }}>
                  <td
                    className="border-b px-3 py-2.5 font-mono text-[11px]"
                    style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                  >
                    {c.sku}
                  </td>
                  <td
                    className="border-b px-3 py-2.5 font-medium"
                    style={{ borderColor: "var(--d-line)" }}
                  >
                    {c.name}
                  </td>
                  <td
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                  >
                    {c.group}
                  </td>
                  <td
                    className="border-b px-3 py-2.5 font-mono tabular-nums"
                    style={{ borderColor: "var(--d-line)" }}
                  >
                    {inr(c.price)}
                  </td>
                  <td className="border-b px-3 py-2.5" style={{ borderColor: "var(--d-line)" }}>
                    {c.reorder > 0 ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-16 overflow-hidden rounded-full"
                          style={{ background: "var(--d-raise)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: low ? TONE.bad : TONE.good }}
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums">
                          {c.stock} {c.unit}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--d-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="border-b px-3 py-2.5" style={{ borderColor: "var(--d-line)" }}>
                    {low && <Chip tone={TONE.bad}>REORDER</Chip>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Billing                                                             */
/* ================================================================== */

function Billing({ b }: { b: BusinessProfile }) {
  const totals = useMemo(() => {
    const paid = b.txns.filter((t) => t.status === "Paid").reduce((s, t) => s + t.amount, 0);
    const pending = b.txns.filter((t) => t.status === "Pending").reduce((s, t) => s + t.amount, 0);
    const overdue = b.txns.filter((t) => t.status === "Overdue").reduce((s, t) => s + t.amount, 0);
    return { paid, pending, overdue };
  }, [b]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{b.terms.orders} &amp; billing</h2>
        <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
          Every {b.terms.order.toLowerCase()} in one ledger, with what is actually collected.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Collected", totals.paid, TONE.good],
          ["Pending", totals.pending, TONE.warn],
          ["Overdue", totals.overdue, TONE.bad],
        ].map(([label, val, tone]) => (
          <div
            key={label as string}
            className="rounded-lg border p-3.5"
            style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
          >
            <p
              className="font-mono text-[10px] tracking-[0.14em] uppercase"
              style={{ color: "var(--d-muted)" }}
            >
              {label as string}
            </p>
            <p className="mt-1.5 text-xl font-bold tabular-nums" style={{ color: tone as string }}>
              {inrShort(val as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--d-line)" }}>
        <table className="w-full min-w-[620px] border-collapse text-[12px]">
          <thead>
            <tr style={{ background: "var(--d-panel)" }}>
              {["Ref", b.terms.customer, "Detail", "Amount", "Status", "Date"].map((h) => (
                <th
                  key={h}
                  className="border-b px-3 py-2.5 text-left font-mono text-[10px] tracking-[0.12em] uppercase"
                  style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.txns.map((t) => (
              <tr key={t.id} style={{ background: "var(--d-bg)" }}>
                <td
                  className="border-b px-3 py-2.5 font-mono text-[11px]"
                  style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                >
                  {t.id}
                </td>
                <td
                  className="border-b px-3 py-2.5 font-medium"
                  style={{ borderColor: "var(--d-line)" }}
                >
                  {t.party}
                </td>
                <td
                  className="border-b px-3 py-2.5"
                  style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                >
                  {t.summary}
                </td>
                <td
                  className="border-b px-3 py-2.5 font-mono tabular-nums"
                  style={{ borderColor: "var(--d-line)" }}
                >
                  {inr(t.amount)}
                </td>
                <td className="border-b px-3 py-2.5" style={{ borderColor: "var(--d-line)" }}>
                  <Chip tone={statusTone(t.status)}>{t.status.toUpperCase()}</Chip>
                </td>
                <td
                  className="border-b px-3 py-2.5"
                  style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                >
                  {t.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Service                                                             */
/* ================================================================== */

function Service({ b }: { b: BusinessProfile }) {
  const cols: Job["status"][] = ["Open", "In progress", "Waiting", "Closed"];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{b.terms.service}</h2>
        <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
          Nothing sits in someone&apos;s head — every job has an owner and a date.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((col) => {
          const jobs = b.jobs.filter((j) => j.status === col);
          return (
            <div
              key={col}
              className="rounded-lg border"
              style={{ borderColor: "var(--d-line)", background: "var(--d-panel)" }}
            >
              <header
                className="flex items-center justify-between border-b px-3 py-2.5"
                style={{ borderColor: "var(--d-line)" }}
              >
                <span className="text-[12px] font-semibold">{col}</span>
                <span
                  className="rounded px-1.5 font-mono text-[10px] tabular-nums"
                  style={{ background: "var(--d-raise)", color: "var(--d-muted)" }}
                >
                  {jobs.length}
                </span>
              </header>
              <div className="flex flex-col gap-2 p-2">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    className="rounded-md border p-2.5"
                    style={{
                      borderColor: "var(--d-line)",
                      background: "var(--d-raise)",
                      opacity: col === "Closed" ? 0.6 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px]" style={{ color: "var(--d-muted)" }}>
                        {j.id}
                      </span>
                      <Chip tone={statusTone(j.priority)}>{j.priority.toUpperCase()}</Chip>
                    </div>
                    <p className="mt-1.5 text-[12px] font-medium">{j.party}</p>
                    <p
                      className="mt-0.5 text-[11px] leading-snug"
                      style={{ color: "var(--d-muted)" }}
                    >
                      {j.issue}
                    </p>
                    <p className="mt-2 font-mono text-[10px]" style={{ color: "var(--d-muted)" }}>
                      {j.assignee} · due {j.due}
                    </p>
                  </div>
                ))}
                {!jobs.length && (
                  <p
                    className="px-1 py-3 text-center text-[10px]"
                    style={{ color: "var(--d-muted)" }}
                  >
                    Nothing here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Automation — the live simulator                                     */
/* ================================================================== */

const FLOW = [
  { k: "form", label: "Enquiry submitted", detail: "Visitor fills the website form" },
  { k: "lead", label: `Record created`, detail: "Added to the system, owner assigned" },
  { k: "wa", label: "WhatsApp sent", detail: "Instant acknowledgement to the customer" },
  { k: "task", label: "Task raised", detail: "Follow-up scheduled for the owner" },
  { k: "dash", label: "Dashboard updated", detail: "Counts and pipeline value move" },
];

function Automation({ b }: { b: BusinessProfile }) {
  const [step, setStep] = useState(-1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const run = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setStep(0);
    FLOW.forEach((_, i) => {
      const t = window.setTimeout(() => setStep(i + 1), (i + 1) * 780);
      timers.current.push(t);
    });
  };

  const done = step >= FLOW.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Automation</h2>
          <p className="text-[12px]" style={{ color: "var(--d-muted)" }}>
            The part you never see working. Press the button and watch it run.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          className="rounded-md px-4 py-2 text-[12px] font-semibold transition-transform hover:scale-[1.02]"
          style={{ background: b.accent, color: "#06101F" }}
        >
          {step < 0 ? "Simulate an enquiry" : "Run it again"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="What happens the moment an enquiry arrives">
          <ol className="flex flex-col gap-2.5">
            {FLOW.map((f, i) => {
              const on = step > i;
              const now = step === i + 1;
              return (
                <li
                  key={f.k}
                  className="flex items-start gap-3 rounded-md border p-3 transition-all duration-300"
                  style={{
                    borderColor: on ? b.accent : "var(--d-line)",
                    background: on ? `${b.accent}12` : "var(--d-raise)",
                    transform: now ? "translateX(4px)" : "none",
                    opacity: step < 0 ? 0.6 : on ? 1 : 0.45,
                  }}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold transition-colors"
                    style={{
                      background: on ? b.accent : "var(--d-line)",
                      color: on ? "#06101F" : "var(--d-muted)",
                    }}
                  >
                    {on ? "✓" : i + 1}
                  </span>
                  <span>
                    <span className="block text-[12px] font-semibold">{f.label}</span>
                    <span className="block text-[11px]" style={{ color: "var(--d-muted)" }}>
                      {f.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px]" style={{ color: done ? TONE.good : "var(--d-muted)" }}>
            {done
              ? "Done — start to finish, no one touched a keyboard."
              : "Total elapsed time in a real system: under two seconds."}
          </p>
        </Panel>

        {/* phone */}
        <div className="flex items-start justify-center">
          <div
            className="w-[248px] overflow-hidden rounded-[22px] border-4"
            style={{ borderColor: "#1C2E4A", background: "#0A1420" }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#075E54" }}>
              <div className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-[11px] font-bold">
                {b.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-white">{b.name}</p>
                <p className="text-[9px] text-white/70">online</p>
              </div>
            </div>
            <div
              className="flex min-h-[236px] flex-col gap-2 p-3"
              style={{ background: "#0B141A" }}
            >
              {step > 2 ? (
                <>
                  <div
                    className="max-w-[86%] self-end rounded-lg rounded-tr-sm px-2.5 py-2"
                    style={{ background: "#005C4B" }}
                  >
                    <p className="text-[11px] leading-snug text-white">
                      Hi 👋 Thanks for reaching out to {b.name}. We have received your enquiry and
                      our team will contact you shortly.
                    </p>
                    <p className="mt-1 text-right text-[8px] text-white/60">10:30 ✓✓</p>
                  </div>
                  {step > 3 && (
                    <div
                      className="max-w-[86%] self-end rounded-lg rounded-tr-sm px-2.5 py-2"
                      style={{ background: "#005C4B" }}
                    >
                      <p className="text-[11px] leading-snug text-white">
                        Your reference number is <b>#{b.leads[0]!.id}</b>. You can reply here any
                        time.
                      </p>
                      <p className="mt-1 text-right text-[8px] text-white/60">10:30 ✓✓</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="m-auto text-center text-[10px]" style={{ color: "var(--d-muted)" }}>
                  Messages appear here when
                  <br />
                  the automation fires.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Panel title="Rules running in this business">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead>
              <tr>
                {["When this happens", "The system does this", "Channel", "Times run"].map((h) => (
                  <th
                    key={h}
                    className="border-b px-3 py-2 text-left font-mono text-[10px] tracking-[0.12em] uppercase"
                    style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.automations.map((a) => (
                <tr key={a.trigger}>
                  <td className="border-b px-3 py-2.5" style={{ borderColor: "var(--d-line)" }}>
                    {a.trigger}
                  </td>
                  <td
                    className="border-b px-3 py-2.5"
                    style={{ borderColor: "var(--d-line)", color: "var(--d-muted)" }}
                  >
                    {a.action}
                  </td>
                  <td className="border-b px-3 py-2.5" style={{ borderColor: "var(--d-line)" }}>
                    <Chip tone={a.channel === "WhatsApp" ? "#25D366" : TONE.cool}>{a.channel}</Chip>
                  </td>
                  <td
                    className="border-b px-3 py-2.5 font-mono tabular-nums"
                    style={{ borderColor: "var(--d-line)" }}
                  >
                    {a.runs.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ================================================================== */
/* Icons                                                               */
/* ================================================================== */

function svg(children: React.ReactNode) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function IconGrid() {
  return svg(
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>,
  );
}
function IconFlow() {
  return svg(
    <>
      <rect x="3" y="4" width="5" height="16" />
      <rect x="10" y="4" width="5" height="11" />
      <rect x="17" y="4" width="4" height="7" />
    </>,
  );
}
function IconBox() {
  return svg(
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>,
  );
}
function IconBill() {
  return svg(
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" />
      <path d="M9 8h6M9 12h6" />
    </>,
  );
}
function IconWrench() {
  return svg(<path d="M14.5 5.5a4 4 0 1 0 4.9 4.9L21 12l-9 9-3-3 9-9Z" />);
}
function IconBolt() {
  return svg(<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />);
}
