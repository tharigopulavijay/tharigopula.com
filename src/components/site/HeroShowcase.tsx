import { cn } from "@/lib/utils";

/**
 * The four things Tharigopula builds, drawn as products orbiting the mark.
 *
 * The hero's job is to make someone want to look further, not to explain the
 * company — so this shows the work rather than listing capabilities. Each panel
 * abstracts something real on the site: the website builder, the operations
 * platform, the automation runner and the dashboards.
 *
 * Drawn rather than screenshotted so it stays sharp at any size, weighs nothing,
 * follows the theme, and never goes stale when a page changes.
 *
 * Orbital on large screens; a plain two-by-two grid below that, where absolute
 * positioning would collapse.
 */

function Panel({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={cn("m-0", className)}>
      <figcaption className="mb-1.5 text-center text-[11px] font-medium text-muted-foreground">
        {label}
      </figcaption>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {children}
      </div>
    </figure>
  );
}

/* ---------- the four product miniatures ---------- */

function WebsiteMini() {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15" />
        <span className="ml-1 h-1.5 flex-1 rounded-full bg-foreground/[0.07]" />
      </div>
      <div className="flex gap-2 p-2.5">
        <div className="flex-1">
          <p className="text-[11px] leading-tight font-semibold">Modern websites that convert.</p>
          <div className="mt-1.5 flex flex-col gap-1">
            <span className="block h-1 w-full rounded-full bg-foreground/10" />
            <span className="block h-1 w-3/5 rounded-full bg-foreground/10" />
          </div>
          <span className="mt-2 inline-block rounded bg-signal px-2 py-1 text-[8px] font-semibold text-signal-foreground">
            Get started
          </span>
        </div>
        <div
          className="h-12 w-14 shrink-0 rounded-md"
          style={{
            background:
              "linear-gradient(160deg, #7FB3E8 0%, #4B7FC4 45%, #2E5D9E 70%, #24486F 100%)",
          }}
        />
      </div>
    </div>
  );
}

function SoftwareMini() {
  const rows = [
    ["Steel rods", "Completed"],
    ["Fasteners", "In transit"],
    ["Bearings", "Pending"],
  ];
  return (
    <div className="flex w-full" style={{ background: "#0C1626" }}>
      <div className="flex w-7 flex-col gap-1.5 border-r p-1.5" style={{ borderColor: "#1C2E4A" }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-full rounded-sm"
            style={{ background: i === 1 ? "#2563EB" : "#2A3D57" }}
          />
        ))}
      </div>
      <div className="flex-1 p-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-semibold" style={{ color: "#E8EFFA" }}>
            Orders
          </span>
          <span className="text-[10px] font-bold" style={{ color: "#E8EFFA" }}>
            ₹8,45,000
          </span>
        </div>
        <div className="mt-1.5 flex flex-col gap-1">
          {rows.map(([name, status], i) => (
            <div key={name} className="flex items-center justify-between gap-1">
              <span className="text-[7.5px]" style={{ color: "#8FA3BD" }}>
                {name}
              </span>
              <span
                className="rounded-sm px-1 py-0.5 text-[6.5px] font-medium"
                style={{
                  background: i === 0 ? "#0F3D2E" : i === 1 ? "#12314F" : "#3D3111",
                  color: i === 0 ? "#4ADE80" : i === 1 ? "#60A5FA" : "#FBBF24",
                }}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationMini() {
  const steps = ["New enquiry", "Send welcome message", "Assign to sales", "Create follow-up task"];
  return (
    <div className="w-full p-2">
      <div className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[7px] font-bold",
                i === 0 ? "bg-signal text-signal-foreground" : "bg-secondary text-foreground/60",
              )}
            >
              {i === 0 ? "1" : i + 1}
            </span>
            <span className="flex-1 rounded border border-border bg-background px-1.5 py-1 text-[7.5px] leading-none">
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataMini() {
  const bars = [38, 55, 44, 68, 52, 82];
  return (
    <div className="flex w-full gap-2 p-2">
      <div className="flex flex-1 flex-col justify-end">
        <svg viewBox="0 0 60 28" className="h-8 w-full" aria-hidden>
          <polyline
            points="0,24 10,18 20,21 30,12 40,15 50,6 60,3"
            fill="none"
            stroke="var(--color-signal, #2563eb)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="mt-1 flex h-5 items-end gap-0.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-sm bg-signal"
              style={{ height: `${h}%`, opacity: i === bars.length - 1 ? 1 : 0.35 }}
            />
          ))}
        </div>
      </div>
      <div className="grid w-12 place-items-center">
        <svg viewBox="0 0 36 36" className="h-11 w-11" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth="6"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="var(--color-signal, #2563eb)"
            strokeWidth="6"
            strokeDasharray="88"
            strokeDashoffset="30"
            transform="rotate(-90 18 18)"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

const PANELS = [
  { label: "Website / Digital Presence", node: <WebsiteMini /> },
  { label: "Business Software", node: <SoftwareMini /> },
  { label: "Automation", node: <AutomationMini /> },
  { label: "Data & AI", node: <DataMini /> },
];

export function HeroShowcase() {
  return (
    <div className="relative">
      {/* Small and medium screens: a plain grid, no absolute positioning. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
        {PANELS.map((p) => (
          <Panel key={p.label} label={p.label}>
            {p.node}
          </Panel>
        ))}
      </div>

      {/* Large screens: the four products orbiting the mark. */}
      <div className="relative hidden aspect-[4/3.4] w-full lg:block">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-border"
        />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card p-3 shadow-sm"
        >
          <img
            src="/logo-mark.png"
            alt=""
            width={96}
            height={96}
            className="h-10 w-10 object-contain"
          />
        </div>

        <Panel
          label={PANELS[0]!.label}
          className="absolute top-0 left-1/2 w-[46%] -translate-x-[42%]"
        >
          {PANELS[0]!.node}
        </Panel>
        <Panel label={PANELS[1]!.label} className="absolute top-[34%] left-0 w-[42%]">
          {PANELS[1]!.node}
        </Panel>
        <Panel label={PANELS[2]!.label} className="absolute top-[32%] right-0 w-[42%]">
          {PANELS[2]!.node}
        </Panel>
        <Panel
          label={PANELS[3]!.label}
          className="absolute bottom-0 left-1/2 w-[44%] -translate-x-[52%]"
        >
          {PANELS[3]!.node}
        </Panel>
      </div>
    </div>
  );
}
