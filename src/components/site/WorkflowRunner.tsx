import { useEffect, useRef, useState } from "react";
import { lead, workflowSteps } from "@/data/demo-automation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * The automation demo: one enquiry, run through seven steps, at the visitor's pace.
 *
 * A static diagram of connected boxes tells a reader that automation exists.
 * Watching a record pick up an owner, an approval and an invoice number tells
 * them what it would do for them — so this actually runs, and the record panel
 * on the right accumulates state as it goes.
 *
 * Manual stepping is the primary control and autoplay is the convenience;
 * anything that only plays leaves a reader waiting for a loop to come round.
 */

export function WorkflowRunner() {
  // -1 means nothing has run yet, so the record panel starts honestly empty.
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = step >= workflowSteps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (done) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setStep((s) => s + 1), step < 0 ? 350 : 1250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, step, done]);

  // Tracking lives outside the state updater — inside, StrictMode's double
  // invocation fires every event twice.
  const run = () => {
    if (done) {
      setStep(-1);
      setPlaying(true);
      track({ name: "demo_opened", demo: "automation-workflow" });
      return;
    }
    setPlaying((p) => !p);
    if (!playing) track({ name: "demo_opened", demo: "automation-workflow" });
  };

  const goTo = (i: number) => {
    setPlaying(false);
    setStep(i);
  };

  const applied = workflowSteps.slice(0, step + 1).flatMap((s) => s.sets);
  const active = step >= 0 ? workflowSteps[step]! : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Lead to result</p>
            <p className="mt-1 text-sm font-semibold">
              {step < 0
                ? "Ready to run"
                : done
                  ? "Complete"
                  : `Step ${step + 1} of ${workflowSteps.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={run}
              className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
            >
              {done ? <ReplayIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
              {done ? "Run again" : playing ? "Pause" : step < 0 ? "Run the workflow" : "Resume"}
            </button>
            {step >= 0 && !done ? (
              <button
                type="button"
                onClick={() => goTo(Math.min(step + 1, workflowSteps.length - 1))}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-foreground/25"
              >
                Next →
              </button>
            ) : null}
          </div>
        </div>

        <div aria-hidden className="mt-4 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-500 ease-out"
            style={{ width: `${((step + 1) / workflowSteps.length) * 100}%` }}
          />
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {workflowSteps.map((s, i) => {
            const state = i < step ? "past" : i === step ? "now" : "future";
            return (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={state === "now"}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
                    state === "now" && "border-signal bg-signal/10",
                    state === "past" && "border-border bg-secondary/50",
                    state === "future" && "border-border bg-card opacity-60 hover:opacity-100",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                      state === "future"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-signal text-signal-foreground",
                    )}
                  >
                    {state === "past" ? <CheckIcon /> : s.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-tight font-semibold">{s.title}</span>
                    <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                      {s.where}
                      {s.manual !== "—" ? ` · ${s.manual} by hand` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
          {active
            ? active.what
            : "Press run to follow one enquiry from the website form all the way to an updated dashboard."}
        </p>
      </div>

      {/* The record. This is the part that makes the point — it fills in as the
          workflow runs, and nobody typed any of it. */}
      <aside className="rounded-2xl border border-border bg-secondary/40 p-4">
        <p className="eyebrow">The record</p>
        <p className="mt-2 font-display text-base font-semibold">{lead.name}</p>
        <p className="text-xs text-muted-foreground">{lead.company}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{lead.enquiry}</p>

        <div className="mt-4 border-t border-border pt-3">
          {applied.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing set yet — the enquiry has only just arrived.
            </p>
          ) : (
            <dl className="flex flex-col gap-1.5">
              {applied.map((f, i) => (
                <div key={`${f.field}-${i}`} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-[11px] text-muted-foreground">{f.field}</dt>
                  <dd className="text-right text-[11px] font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {done ? (
          <p className="mt-4 rounded-lg bg-signal/10 p-2.5 text-[11px] leading-relaxed text-foreground">
            Every field above was set automatically. The same enquiry handled by hand is roughly
            <strong> 44 minutes</strong> of someone's day.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/* ---------- icons ---------- */

const sw = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}
function ReplayIcon() {
  return (
    <svg {...sw}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
