import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The six pieces of a connected business system, and the order work moves
 * through them.
 *
 * This is the hero's whole argument made visual: a business does not buy a
 * website, then separately buy a CRM, then separately buy automation. Work
 * flows from one into the next, and the point of the practice is that the
 * pieces connect. Saying that in a paragraph is weak; showing the arrows is not.
 *
 * Cycles slowly to draw the eye along the path. Pauses on hover or focus so a
 * reader is never fighting the animation, and stops entirely under
 * prefers-reduced-motion.
 */

type Node = {
  id: string;
  label: string;
  note: string;
  icon: React.ReactNode;
};

const NODES: Node[] = [
  { id: "website", label: "Website", note: "Attract & engage", icon: <IconWindow /> },
  { id: "crm", label: "CRM", note: "Capture & manage", icon: <IconPeople /> },
  { id: "operations", label: "Operations", note: "Plan & execute", icon: <IconGear /> },
  { id: "automation", label: "Automation", note: "Save time, cut errors", icon: <IconBolt /> },
  { id: "data", label: "Data", note: "Analyse & visualise", icon: <IconChart /> },
  { id: "ai", label: "AI", note: "Predict & optimise", icon: <IconSpark /> },
];

export function SystemFlow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || paused) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % NODES.length), 2400);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {NODES.map((n, i) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-300 sm:p-4",
              i === active
                ? "border-signal bg-signal/[0.06] shadow-sm"
                : "border-border bg-background hover:border-signal/40",
            )}
          >
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-lg transition-colors sm:h-11 sm:w-11",
                i === active
                  ? "bg-signal text-signal-foreground"
                  : "bg-secondary text-foreground/70",
              )}
              aria-hidden
            >
              {n.icon}
            </span>
            <span className="text-[13px] leading-tight font-semibold sm:text-sm">{n.label}</span>
            <span className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
              {n.note}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal" />
        Each piece feeds the next. Start with one, add the rest when the business needs it.
      </p>
    </div>
  );
}

/* ---------- icons ---------- */

function svg(children: React.ReactNode) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconWindow() {
  return svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.5h.01" />
    </>,
  );
}
function IconPeople() {
  return svg(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-2-5.2M21 20a5 5 0 0 0-3-4.6" />
    </>,
  );
}
function IconGear() {
  return svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>,
  );
}
function IconBolt() {
  return svg(<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />);
}
function IconChart() {
  return svg(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
    </>,
  );
}
function IconSpark() {
  return svg(
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <circle cx="12" cy="12" r="3.5" />
    </>,
  );
}
