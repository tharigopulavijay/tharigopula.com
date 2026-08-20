import { useState } from "react";
import type { AppPreset } from "@/data/demo-apps";
import { cn } from "@/lib/utils";

/**
 * A working app, not a picture of one.
 *
 * The tabs really switch, the categories really filter, and the same shell
 * takes four different businesses. That matters more than fidelity to any one
 * screenshot: the argument this demo has to make is "your app would work like
 * this", and a static image cannot make it.
 *
 * The app keeps its own light surface in both site themes. A demo phone is a
 * depicted object — if its screen followed the page it would stop reading as a
 * separate device and start reading as part of the layout.
 */

type Tab = "home" | "list" | "stats" | "profile";

export function MobileAppDemo({
  preset,
  wide,
}: {
  preset: AppPreset;
  /** Tablet layout: navigation moves to a side rail and the content splits. */
  wide?: boolean | undefined;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [category, setCategory] = useState(0);

  const screen = (
    <>
      {tab === "home" ? (
        <HomeScreen
          preset={preset}
          category={category}
          onCategory={setCategory}
          onSeeAll={() => setTab("list")}
        />
      ) : null}
      {tab === "list" ? <ListScreen preset={preset} /> : null}
      {tab === "stats" ? <StatsScreen preset={preset} /> : null}
      {tab === "profile" ? <ProfileScreen preset={preset} /> : null}
    </>
  );

  // A tablet running a stretched phone layout looks like a mistake, so the
  // wide variant does what a real tablet build does: nav to the side, and the
  // second pane filled with what would otherwise be a separate screen.
  if (wide) {
    return (
      <div className="flex h-full bg-[#F7F9FC] text-[#0B1524]">
        <SideRail preset={preset} tab={tab} onTab={setTab} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header preset={preset} />
          <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] divide-x divide-[#E4EAF2]">
            <div className="min-h-0 overflow-hidden">{screen}</div>
            <div className="min-h-0 overflow-hidden bg-white/40">
              {tab === "stats" ? <ListScreen preset={preset} /> : <StatsScreen preset={preset} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#F7F9FC] text-[#0B1524]">
      <Header preset={preset} />
      <div className="flex-1 overflow-hidden">{screen}</div>
      <TabBar preset={preset} tab={tab} onTab={setTab} />
    </div>
  );
}

/** Vertical navigation for the tablet layout. */
function SideRail({
  preset,
  tab,
  onTab,
}: {
  preset: AppPreset;
  tab: Tab;
  onTab: (t: Tab) => void;
}) {
  return (
    <div className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-[#E4EAF2] bg-white pt-8">
      <span
        className="mb-3 grid h-8 w-8 place-items-center rounded-lg text-[12px] font-bold text-white"
        style={{ background: preset.accent }}
      >
        {preset.brand.charAt(0)}
      </span>
      {tabsFor(preset).map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className="flex w-full flex-col items-center gap-0.5 py-2 transition-colors"
            style={{ color: active ? preset.accent : "#61708A" }}
          >
            {t.icon}
            <span className="text-[8px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- chrome ---------- */

function Header({ preset }: { preset: AppPreset }) {
  return (
    <div className="shrink-0 px-4 pt-8 pb-3" style={{ background: preset.accent }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-medium text-white/90">{preset.brand}</p>
          <p className="mt-0.5 text-[13px] font-semibold text-white">{preset.greeting}</p>
        </div>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-[10px] font-bold text-white">
          {preset.person.name.charAt(0)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2">
        <SearchIcon />
        <span className="truncate text-[9.5px] text-[#66748A]">{preset.searchHint}</span>
      </div>
    </div>
  );
}

/** The four destinations, named for whichever business the app is wearing. */
function tabsFor(preset: AppPreset): { id: Tab; label: string; icon: React.ReactNode }[] {
  return [
    { id: "home", label: "Home", icon: <HomeIcon /> },
    { id: "list", label: preset.id === "booking" ? "Bookings" : "Orders", icon: <ListIcon /> },
    { id: "stats", label: preset.id === "business" ? "Reports" : "Activity", icon: <ChartIcon /> },
    { id: "profile", label: "Profile", icon: <UserIcon /> },
  ];
}

function TabBar({ preset, tab, onTab }: { preset: AppPreset; tab: Tab; onTab: (t: Tab) => void }) {
  const tabs = tabsFor(preset);

  return (
    <div className="shrink-0 border-t border-[#E4EAF2] bg-white px-1 pt-1.5 pb-2">
      <div className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className="flex flex-col items-center gap-0.5 py-1 transition-colors"
              style={{ color: active ? preset.accent : "#61708A" }}
            >
              {t.icon}
              <span className="text-[8px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- screens ---------- */

function HomeScreen({
  preset,
  category,
  onCategory,
  onSeeAll,
}: {
  preset: AppPreset;
  category: number;
  onCategory: (i: number) => void;
  onSeeAll: () => void;
}) {
  // The list genuinely responds to the chips. Rotating the order is enough to
  // prove the control is live without inventing four separate catalogues.
  const items = [...preset.items.slice(category), ...preset.items.slice(0, category)];

  return (
    <div className="h-full overflow-y-auto px-3 pt-3 pb-2">
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {preset.categories.map((c, i) => {
          const active = i === category;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onCategory(i)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-medium transition-colors",
                !active && "bg-white text-[#55637A]",
              )}
              style={active ? { background: preset.accent, color: "#fff" } : undefined}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold">{preset.categories[category]}</p>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[8.5px] font-medium"
          style={{ color: preset.accent }}
        >
          See all →
        </button>
      </div>

      <div className="mt-1.5 flex flex-col gap-1.5">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-2 rounded-lg bg-white p-2">
            <span
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-md"
              style={{ background: `color-mix(in srgb, ${preset.accent} 16%, #EEF2F8)` }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold">{it.name}</p>
              <p className="truncate text-[8.5px] text-[#66748A]">{it.meta}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold">{it.price}</p>
              {it.tag ? (
                <p className="text-[7.5px] font-medium" style={{ color: preset.accent }}>
                  {it.tag}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Delivered: { bg: "#E4F6EC", fg: "#0B7A4B" },
  Confirmed: { bg: "#E4EFFD", fg: "#1D5FC4" },
  "In progress": { bg: "#FDF1DE", fg: "#9A6206" },
  Pending: { bg: "#F1E9FB", fg: "#6337B8" },
};

function ListScreen({ preset }: { preset: AppPreset }) {
  return (
    <div className="h-full overflow-y-auto px-3 pt-3">
      <p className="text-[10px] font-semibold">{preset.listTitle}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {preset.orders.map((o) => {
          const tone = STATUS_TONE[o.status]!;
          return (
            <div key={o.ref} className="rounded-lg bg-white p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[10px] font-semibold">{o.title}</p>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[7.5px] font-semibold"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {o.status}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <p className="font-mono text-[8px] text-[#66748A]">
                  {o.ref} • {o.when}
                </p>
                <p className="text-[9.5px] font-bold">{o.amount}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsScreen({ preset }: { preset: AppPreset }) {
  return (
    <div className="h-full overflow-y-auto px-3 pt-3">
      <p className="text-[10px] font-semibold">{preset.statsTitle}</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {preset.stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-2.5">
            <p className="text-[8.5px] text-[#66748A]">{s.label}</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="text-[15px] leading-none font-bold">{s.value}</p>
              <p className="text-[8px] font-semibold" style={{ color: preset.accent }}>
                {s.delta}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* A drawn trend rather than a chart library — it only has to read as data. */}
      <div className="mt-2 rounded-lg bg-white p-2.5">
        <p className="text-[8.5px] text-[#66748A]">Last 7 days</p>
        <div className="mt-2 flex h-14 items-end gap-1">
          {[42, 58, 39, 71, 55, 84, 68].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                background:
                  i === 5 ? preset.accent : `color-mix(in srgb, ${preset.accent} 26%, #E8EEF7)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({ preset }: { preset: AppPreset }) {
  const rows = [
    "Personal information",
    "Saved addresses",
    "Payment methods",
    "Notifications",
    "Help & support",
  ];
  return (
    <div className="h-full overflow-y-auto px-3 pt-3">
      <div className="flex items-center gap-2.5 rounded-lg bg-white p-2.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
          style={{ background: preset.accent }}
        >
          {preset.person.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold">{preset.person.name}</p>
          <p className="truncate text-[8.5px] text-[#66748A]">{preset.person.sub}</p>
        </div>
      </div>

      <div className="mt-2 overflow-hidden rounded-lg bg-white">
        {rows.map((r, i) => (
          <div
            key={r}
            className={cn(
              "flex items-center justify-between px-2.5 py-2.5",
              i > 0 && "border-t border-[#EEF2F8]",
            )}
          >
            <span className="text-[9.5px]">{r}</span>
            <span className="text-[9px] text-[#B3BECD]">›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- icons ---------- */

function icon(children: React.ReactNode) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function HomeIcon() {
  return icon(<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />);
}
function ListIcon() {
  return icon(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8.5 9.5h7M8.5 14.5h4" />
    </>,
  );
}
function ChartIcon() {
  return icon(<path d="M5 19V11M10 19V5M15 19v-5M20 19v-9" />);
}
function UserIcon() {
  return icon(
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>,
  );
}
function SearchIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#61708A"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}
