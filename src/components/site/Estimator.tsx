import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { industries } from "@/data/industries";
import { templates, categoryBySlug } from "@/data/templates";
import { caseStudies } from "@/data/portfolio";
import { whatsappLink } from "@/data/site";
import {
  bases,
  businessSizes,
  complexityFactors,
  computeEstimate,
  emptyState,
  modulesFor,
  objectives,
  timelines,
  type EstimatorState,
} from "@/data/estimator";
import { ESTIMATOR_HANDOFF_KEY } from "@/lib/enquiry";
import { track } from "@/lib/analytics";

/**
 * Renders the configured scope as plain text that travels with the enquiry,
 * so a proposal request arrives already specified.
 */
function buildHandoffSummary({
  estimate,
  baseLabel,
  state,
}: {
  estimate: ReturnType<typeof computeEstimate>;
  baseLabel: string | undefined;
  state: EstimatorState;
}): string {
  const label = (list: { id: string; label: string }[], id: string) =>
    list.find((x) => x.id === id)?.label;

  const lines: string[] = ["Project configurator summary", ""];

  if (baseLabel) lines.push(`Starting point: ${baseLabel}`);
  const industry = industries.find((i) => i.slug === state.industry)?.name;
  if (industry) lines.push(`Industry: ${industry}`);
  const objective = label(objectives, state.objective);
  if (objective) lines.push(`Main objective: ${objective}`);
  const size = label(businessSizes, state.size);
  if (size) lines.push(`Business size: ${size}`);
  const timeline = label(timelines, state.timeline);
  if (timeline) lines.push(`Timeline: ${timeline}`);

  if (estimate.baseLine) {
    lines.push("", "Breakdown", `- ${estimate.baseLine.label}: ${estimate.baseLine.detail}`);
  }
  for (const m of estimate.moduleLines) lines.push(`- ${m.label}: ${m.detail}`);
  if (estimate.complexityLine) {
    lines.push(`- ${estimate.complexityLine.label}: ${estimate.complexityLine.detail}`);
  }
  if (estimate.rushLine) lines.push(`- ${estimate.rushLine.label}: ${estimate.rushLine.detail}`);
  if (estimate.includedLines.length) {
    lines.push(`- Included at no extra cost: ${estimate.includedLines.join(", ")}`);
  }

  lines.push(
    "",
    `Indicative estimate: ${estimate.lowLabel} – ${estimate.highLabel}`,
    `Complexity: ${estimate.complexity} · Estimated delivery: ${estimate.weeks}`,
    "Confidence: preliminary — to be confirmed after scoping.",
  );

  return lines.join("\n");
}

const stepTitles = [
  "What do you want to build?",
  "What type of business are you?",
  "What is your main objective?",
  "Select the functionality you need",
  "Anything that adds complexity?",
  "How big is your team?",
  "What is your timeline?",
  "Your indicative estimate",
];

function Choice({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all",
        selected
          ? "border-signal bg-signal/10 font-medium"
          : "border-border bg-card hover:border-foreground/25",
      )}
    >
      <span>
        {label}
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-signal" /> : null}
    </button>
  );
}

export function Estimator({
  compact = false,
  initialIndustry,
  initialBase,
}: {
  compact?: boolean | undefined;
  /** Pre-selects the industry when arriving from an industry page, case study or demo. */
  initialIndustry?: string | undefined;
  /** Pre-selects the starting point, e.g. a case study suggesting "crm". */
  initialBase?: string | undefined;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<EstimatorState>(() => ({
    ...emptyState,
    industry:
      initialIndustry && industries.some((i) => i.slug === initialIndustry)
        ? initialIndustry
        : emptyState.industry,
    base: initialBase && bases.some((b) => b.id === initialBase) ? initialBase : emptyState.base,
  }));

  const selectedBase = bases.find((b) => b.id === state.base);
  const availableModules = useMemo(() => modulesFor(state.base), [state.base]);
  const estimate = useMemo(() => computeEstimate(state), [state]);

  const set = <K extends keyof EstimatorState>(key: K, value: EstimatorState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  // Step names make the drop-off readable — "they leave at step 4" is useless,
  // "they leave when asked about integrations" is actionable.
  const STEP_FIELDS = [
    "base",
    "industry",
    "objective",
    "modules",
    "complexity",
    "size",
    "timeline",
    "result",
  ];

  // Tracking stays outside the state updater on purpose. React invokes updaters
  // more than once (StrictMode, and any future concurrent re-render), which
  // silently double-counted every step and fired estimator_completed twice.
  const next = () => {
    const to = Math.min(step + 1, 7);
    if (to === step) return;

    track({ name: "estimator_step_completed", step, field: STEP_FIELDS[step] ?? String(step) });
    if (to === 7) {
      track({
        name: "estimator_completed",
        base: state.base,
        low: estimate.lowValue,
        high: estimate.highValue,
        modules: state.modules.length,
      });
    }
    setStep(to);
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = [
    !!state.base,
    !!state.industry,
    !!state.objective,
    true,
    true,
    !!state.size,
    !!state.timeline,
    true,
  ][step];

  const templateCategoryMap: Record<string, string> = {
    launch: "essential",
    essential: "essential",
    dynamic: "dynamic",
    premium: "premium-interactive",
    cinematic: "cinematic",
    threed: "immersive-3d",
  };
  const templateCategory = selectedBase ? templateCategoryMap[selectedBase.id] : undefined;

  const recommendedTemplate =
    templates.find(
      (t) =>
        templateCategory &&
        t.category === templateCategory &&
        t.industry
          .toLowerCase()
          .includes(
            (industries.find((i) => i.slug === state.industry)?.name ?? "")
              .toLowerCase()
              .split(" ")[0] ?? "~",
          ),
    ) ?? templates.find((t) => templateCategory && t.category === templateCategory);

  const recommendedCase =
    caseStudies.find((c) => c.industrySlug === state.industry) ?? caseStudies[0];

  const websiteBases = bases.filter((b) => b.group === "website");
  const softwareBases = bases.filter((b) => b.group === "software");

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card",
        compact ? "p-5 sm:p-7" : "p-5 sm:p-8",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Step {step + 1} / 8
        </p>
        <div className="flex flex-1 gap-1">
          {stepTitles.map((t, i) => (
            <span
              key={t}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-signal" : "bg-border",
              )}
            />
          ))}
        </div>
      </div>

      <h3 className="mt-5 font-display text-xl font-semibold sm:text-2xl">{stepTitles[step]}</h3>

      <div className="mt-5">
        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Websites
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {websiteBases.map((b) => (
                  <Choice
                    key={b.id}
                    label={`${b.label} — from ₹${b.base[0].toLocaleString("en-IN")}`}
                    hint={b.hint}
                    selected={state.base === b.id}
                    onClick={() => {
                      set("base", b.id);
                      set("modules", []);
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Software, apps & platforms
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {softwareBases.map((b) => (
                  <Choice
                    key={b.id}
                    label={`${b.label} — from ₹${b.base[0].toLocaleString("en-IN")}`}
                    hint={b.hint}
                    selected={state.base === b.id}
                    onClick={() => {
                      set("base", b.id);
                      set("modules", []);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {industries.map((i) => (
              <Choice
                key={i.slug}
                label={i.name}
                selected={state.industry === i.slug}
                onClick={() => set("industry", i.slug)}
              />
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {objectives.map((o) => (
              <Choice
                key={o.id}
                label={o.label}
                selected={state.objective === o.id}
                onClick={() => set("objective", o.id)}
              />
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <>
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">
              Select whatever sounds relevant. Responsive design, contact forms, WhatsApp, basic
              SEO, analytics and deployment are already included in your base package — only
              genuinely extra work is priced below.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableModules.map((m) => (
                <Choice
                  key={m.id}
                  label={m.label}
                  hint={
                    selectedBase && m.includedInBases?.includes(selectedBase.id)
                      ? "Already included in your base"
                      : m.cost === null
                        ? "Quoted separately"
                        : `+₹${m.cost[0].toLocaleString("en-IN")} – ₹${m.cost[1].toLocaleString("en-IN")}`
                  }
                  selected={state.modules.includes(m.id)}
                  onClick={() =>
                    set(
                      "modules",
                      state.modules.includes(m.id)
                        ? state.modules.filter((x) => x !== m.id)
                        : [...state.modules, m.id],
                    )
                  }
                />
              ))}
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">
              These don't add a fixed module, but they modestly affect effort — shown transparently
              as their own line in your estimate.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {complexityFactors.map((f) => (
                <Choice
                  key={f.id}
                  label={f.label}
                  hint={`+${Math.round(f.pct[0] * 100)}%–${Math.round(f.pct[1] * 100)}%`}
                  selected={state.complexity.includes(f.id)}
                  onClick={() =>
                    set(
                      "complexity",
                      state.complexity.includes(f.id)
                        ? state.complexity.filter((x) => x !== f.id)
                        : [...state.complexity, f.id],
                    )
                  }
                />
              ))}
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">
              This is for our records only — team size does not change your price.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {businessSizes.map((s) => (
                <Choice
                  key={s.id}
                  label={s.label}
                  selected={state.size === s.id}
                  onClick={() => set("size", s.id)}
                />
              ))}
            </div>
          </>
        ) : null}

        {step === 6 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {timelines.map((t) => (
              <Choice
                key={t.id}
                label={t.label}
                selected={state.timeline === t.id}
                onClick={() => set("timeline", t.id)}
              />
            ))}
          </div>
        ) : null}

        {step === 7 ? (
          <div>
            <div className="rounded-lg border border-border bg-secondary/60 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Indicative Estimate
                </p>
                <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Confidence: Preliminary
                </span>
              </div>

              <dl className="mt-4 divide-y divide-border text-sm">
                {estimate.baseLine ? (
                  <div className="flex items-center justify-between py-2">
                    <dt>{estimate.baseLine.label}</dt>
                    <dd className="font-medium">{estimate.baseLine.detail}</dd>
                  </div>
                ) : null}
                {estimate.moduleLines.map((l) => (
                  <div key={l.label} className="flex items-center justify-between py-2">
                    <dt>{l.label}</dt>
                    <dd className="font-medium">{l.detail}</dd>
                  </div>
                ))}
                {estimate.complexityLine ? (
                  <div className="flex items-center justify-between py-2">
                    <dt>
                      {estimate.complexityLine.label}
                      <span className="block text-xs text-muted-foreground">
                        {estimate.complexityLine.factors.join(", ")}
                      </span>
                    </dt>
                    <dd className="font-medium">{estimate.complexityLine.detail}</dd>
                  </div>
                ) : null}
                {estimate.rushLine ? (
                  <div className="flex items-center justify-between py-2">
                    <dt>{estimate.rushLine.label}</dt>
                    <dd className="font-medium">{estimate.rushLine.detail}</dd>
                  </div>
                ) : null}
                {estimate.includedLines.length ? (
                  <div className="flex items-start justify-between gap-4 py-2">
                    <dt>{estimate.includedLines.join(" / ")}</dt>
                    <dd className="shrink-0 font-medium text-signal">Included</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <p className="font-display text-base font-semibold">Estimated project</p>
                <p className="font-display text-2xl font-semibold sm:text-3xl">
                  {estimate.lowLabel} – {estimate.highLabel}
                </p>
              </div>
              {estimate.hasQuotedSeparately ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Advanced custom 3D work is quoted separately once scope is understood.
                </p>
              ) : null}

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Complexity</dt>
                  <dd className="text-sm font-medium">{estimate.complexity}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Estimated delivery timeline</dt>
                  <dd className="text-sm font-medium">{estimate.weeks}</dd>
                </div>
              </dl>
            </div>

            {estimate.crossSell.length ? (
              <div className="mt-5 rounded-lg border border-border p-5">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  You may also need
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {estimate.crossSell.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-secondary/50 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">{c.range}</p>
                      </div>
                      <a
                        href={whatsappLink(
                          `Hello Tharigopula Technologies, I'd like to add "${c.label}" to my project.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium"
                      >
                        Ask
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {recommendedTemplate ? (
                <Link
                  to="/website-studio/$slug"
                  params={{ slug: recommendedTemplate.slug }}
                  className="rounded-lg border border-border p-4 transition-colors hover:border-foreground/25"
                >
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Suggested direction
                  </p>
                  <p className="mt-2 font-display font-semibold">{recommendedTemplate.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {categoryBySlug(recommendedTemplate.category)?.name}
                  </p>
                </Link>
              ) : null}
              {recommendedCase ? (
                <Link
                  to="/portfolio/$slug"
                  params={{ slug: recommendedCase.slug }}
                  className="rounded-lg border border-border p-4 transition-colors hover:border-foreground/25"
                >
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Relevant case study
                  </p>
                  <p className="mt-2 font-display font-semibold">{recommendedCase.industry}</p>
                  <p className="text-sm text-muted-foreground">{recommendedCase.summary}</p>
                </Link>
              ) : null}
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              Final pricing is confirmed after understanding business logic, integrations and
              content requirements.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/contact"
                onClick={() => {
                  // Carry the scope across so the enquiry arrives fully specified
                  // and the visitor never re-explains what they just configured.
                  try {
                    sessionStorage.setItem(
                      ESTIMATOR_HANDOFF_KEY,
                      buildHandoffSummary({ estimate, baseLabel: selectedBase?.label, state }),
                    );
                  } catch {
                    /* private mode — the enquiry still sends, just without scope */
                  }
                }}
                className="rounded-md bg-ink px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground"
              >
                Request Detailed Proposal
              </Link>
              <a
                href={whatsappLink(
                  `Hello Tharigopula Technologies. I used the project estimator: ${
                    selectedBase?.label ?? "project"
                  }, estimated ${estimate.lowLabel} – ${estimate.highLabel}. I would like to discuss.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border px-5 py-3.5 text-center text-sm font-semibold"
              >
                Discuss on WhatsApp
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="rounded-md px-3 py-2.5 text-sm text-muted-foreground disabled:opacity-40"
        >
          Back
        </button>
        {step < 7 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canContinue}
            className="rounded-md bg-ink px-6 py-3 text-sm font-semibold text-ink-foreground disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setState(emptyState);
              setStep(0);
            }}
            className="rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Start again
          </button>
        )}
      </div>
    </div>
  );
}
