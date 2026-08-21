/**
 * The moving glimpse on each solution card.
 *
 * These replace four still drawings. A static picture of a dashboard reads as a
 * picture of software; a dashboard whose figure climbs and whose bars grow
 * reads as software. Motion is what was missing, and it is the cheap half of
 * the impression — every loop here is transform and opacity only, a few KB of
 * markup, no video, no images, no library.
 *
 * Each preview shows the one thing that makes its subject legible in about two
 * seconds: a page scrolling, orders arriving, a workflow firing, a chart being
 * drawn. They mirror what the real demos in /showcase actually do, so nothing
 * here promises something the product does not.
 */

const LOOP = "7s";

/** Shared browser/app chrome so the previews read as real screens. */
function Chrome({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-lg"
      style={{ background: dark ? "#0C1626" : "#FFFFFF" }}
    >
      <div
        className="flex shrink-0 items-center gap-1 px-2 py-1.5"
        style={{ background: dark ? "#111E33" : "#F1F5FB" }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dark ? "#2A3D57" : "#D3DEEE" }}
          />
        ))}
        <span
          className="ml-1.5 h-1.5 flex-1 rounded-full"
          style={{ background: dark ? "#1B2C45" : "#E3EAF5" }}
        />
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/* ---------- 1. Websites: a page scrolling past ---------- */

function WebsitePreview({ accent }: { accent: string }) {
  const band = (h: number, w: string, c: string) => (
    <span className="block rounded" style={{ height: h, width: w, background: c }} />
  );
  return (
    <Chrome>
      <div
        className="absolute inset-x-0 top-0 flex flex-col gap-2 p-2.5"
        style={{ animation: `pv-scroll ${LOOP} cubic-bezier(0.4,0,0.2,1) infinite` }}
      >
        {/* hero */}
        <div className="rounded-md p-2" style={{ background: "#EEF4FD" }}>
          {band(5, "72%", "#20304A")}
          {<span className="mt-1 block" />}
          {band(3, "90%", "#AFC3DE")}
          <span
            className="mt-1.5 block rounded"
            style={{ height: 8, width: 34, background: accent }}
          />
        </div>
        {/* three cards */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 rounded-md p-1.5" style={{ background: "#F5F8FD" }}>
              <span
                className="mb-1 block h-3 w-3 rounded"
                style={{ background: `color-mix(in srgb, ${accent} 30%, transparent)` }}
              />
              {band(2.5, "100%", "#D6E0EE")}
              {<span className="mt-1 block" />}
              {band(2.5, "70%", "#E2E9F3")}
            </div>
          ))}
        </div>
        {/* image + copy */}
        <div className="flex gap-1.5">
          <span
            className="h-12 w-2/5 shrink-0 rounded-md"
            style={{ background: "linear-gradient(150deg,#9FC1E8,#4E7CB0)" }}
          />
          <div className="flex-1 pt-1">
            {band(3.5, "85%", "#26364F")}
            {<span className="mt-1.5 block" />}
            {band(2.5, "100%", "#DCE5F1")}
            {<span className="mt-1 block" />}
            {band(2.5, "60%", "#E6EDF6")}
          </div>
        </div>
        {/* testimonial + footer */}
        <div className="rounded-md p-2" style={{ background: "#F5F8FD" }}>
          {band(2.5, "95%", "#D6E0EE")}
          {<span className="mt-1 block" />}
          {band(2.5, "75%", "#E2E9F3")}
        </div>
        <div className="rounded-md p-2" style={{ background: "#20304A" }}>
          {band(2.5, "45%", "#4A5D7A")}
          {<span className="mt-1 block" />}
          {band(2.5, "62%", "#3A4C68")}
        </div>
      </div>
    </Chrome>
  );
}

/* ---------- 2. Business software: orders arriving ---------- */

const ORDERS: [string, string, string][] = [
  ["Steel rods", "Completed", "#1F9D55"],
  ["Fasteners", "In transit", "#2563EB"],
  ["Bearings", "Pending", "#C2760A"],
  ["Couplings", "Completed", "#1F9D55"],
];

function SoftwarePreview({ accent }: { accent: string }) {
  return (
    <Chrome dark>
      <div className="flex h-full">
        <div className="flex w-6 shrink-0 flex-col gap-1 p-1.5" style={{ background: "#0A1524" }}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 rounded-full"
              style={{ background: i === 1 ? accent : "#22344E", opacity: i === 1 ? 1 : 0.8 }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1 p-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[7px] font-semibold" style={{ color: "#8FA3BD" }}>
              Orders
            </span>
            {/* The total rolls up to its figure rather than sitting there. */}
            <Reel />
          </div>

          <div className="mt-1.5 flex flex-col gap-1">
            {ORDERS.map(([name, status, colour], i) => (
              <div
                key={name}
                className="flex items-center justify-between gap-1 rounded px-1 py-[3px]"
                style={{
                  background: "#111E33",
                  animation: `pv-row-in ${LOOP} ease-out infinite`,
                  animationDelay: `${i * 0.45}s`,
                }}
              >
                <span className="truncate text-[6.5px]" style={{ color: "#C3D2E6" }}>
                  {name}
                </span>
                <span
                  className="shrink-0 rounded px-1 text-[5.5px] font-semibold"
                  style={{
                    background: `color-mix(in srgb, ${colour} 22%, transparent)`,
                    color: colour,
                  }}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

/**
 * A digit reel. Cheaper and steadier than a JS counter — no timers, no state,
 * and it cannot drift out of sync with the rest of the loop.
 */
function Reel() {
  const digits = ["8", "4", "5"];
  return (
    <span className="flex items-center text-[9px] font-bold" style={{ color: "#E8EFFA" }}>
      ₹
      {digits.map((d, i) => (
        <span key={i} className="relative inline-block h-[10px] w-[6px] overflow-hidden">
          <span
            className="absolute inset-x-0 top-0 flex flex-col items-center"
            style={{
              // Stop on the target digit: each row is 10px tall.
              ["--pv-stop" as string]: `-${Number(d) * 10}px`,
              animation: `pv-reel ${LOOP} cubic-bezier(0.22,1,0.36,1) infinite`,
            }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block h-[10px] leading-[10px]">
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
      ,000
    </span>
  );
}

/* ---------- 3. Automation: a workflow firing ---------- */

const STEPS = ["New enquiry", "Send welcome", "Assign to sales", "Create follow-up"];

function AutomationPreview({ accent }: { accent: string }) {
  return (
    <Chrome>
      <div className="relative h-full p-2">
        {STEPS.map((label, i) => (
          <div key={label} className="relative">
            <div
              className="flex items-center gap-1.5 rounded px-1.5 py-[3px]"
              style={{
                background: "#F4F8FD",
                animation: `pv-step ${LOOP} ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            >
              <span
                className="grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full text-[5px] font-bold text-white"
                style={{ background: accent }}
              >
                {i + 1}
              </span>
              <span className="truncate text-[6.5px]" style={{ color: "#33465E" }}>
                {label}
              </span>
            </div>

            {/* connector with a pulse running down it */}
            {i < STEPS.length - 1 ? (
              <div className="relative ml-[10px] h-[7px] w-px" style={{ background: "#D9E3F1" }}>
                <span
                  className="absolute -left-[1.5px] h-1 w-1 rounded-full"
                  style={{
                    background: accent,
                    animation: `pv-pulse ${LOOP} ease-in-out infinite`,
                    animationDelay: `${i * 0.5 + 0.25}s`,
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Chrome>
  );
}

/* ---------- 4. Data & AI: a chart drawing itself ---------- */

function DataPreview({ accent }: { accent: string }) {
  const pts = "4,34 18,27 32,30 46,18 60,21 74,9 88,12";
  return (
    <Chrome dark>
      <div className="flex h-full items-center gap-2 p-2">
        <div className="min-w-0 flex-1">
          <span className="block text-[6px]" style={{ color: "#8FA3BD" }}>
            Revenue trend
          </span>
          <svg viewBox="0 0 92 40" className="mt-1 w-full" aria-hidden>
            <polyline
              points={pts}
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                ["--pv-len" as string]: "160",
                strokeDasharray: 160,
                animation: `pv-draw ${LOOP} cubic-bezier(0.4,0,0.2,1) infinite`,
              }}
            />
          </svg>
          <div className="mt-1 flex items-end gap-[3px]" style={{ height: 14 }}>
            {[0.45, 0.7, 0.55, 0.85, 0.65, 1].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h * 100}%`,
                  background: i === 5 ? accent : "#22344E",
                  transformOrigin: "bottom",
                  animation: `pv-grow ${LOOP} cubic-bezier(0.22,1,0.36,1) infinite`,
                  animationDelay: `${i * 0.09}s`,
                }}
              />
            ))}
          </div>
        </div>

        <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r="17" fill="none" stroke="#1B2C45" strokeWidth="7" />
          <circle
            cx="22"
            cy="22"
            r="17"
            fill="none"
            stroke={accent}
            strokeWidth="7"
            strokeLinecap="round"
            style={{
              strokeDasharray: 126,
              animation: `pv-sweep ${LOOP} cubic-bezier(0.4,0,0.2,1) infinite`,
            }}
          />
        </svg>
      </div>
    </Chrome>
  );
}

/* ---------- dispatch ---------- */

const PREVIEWS: Record<string, (p: { accent: string }) => React.JSX.Element> = {
  web: WebsitePreview,
  software: SoftwarePreview,
  automation: AutomationPreview,
  data: DataPreview,
};

export function PillarPreview({ id, accent }: { id: string; accent: string }) {
  const Preview = PREVIEWS[id] ?? WebsitePreview;
  return (
    <div
      className="h-full w-full p-2"
      style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}
    >
      <Preview accent={accent} />
    </div>
  );
}
