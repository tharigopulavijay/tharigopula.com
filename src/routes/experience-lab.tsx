import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";
import { Pill, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { DemoFrame } from "@/components/site/DemoFrame";
import { comparisonMatrix, experienceLevels, guideQuestions } from "@/data/experience-lab";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/experience-lab")({
  head: () => ({
    meta: [
      { title: "Experience Lab — See The Difference Live | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "One business, five live website experiences. Compare Essential, Dynamic, Interactive, Cinematic and 3D Immersive websites side by side with real working demos and prices.",
      },
      { property: "og:title", content: "Experience Lab | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Stop guessing what a website level means. Scroll the same business built five different ways.",
      },
    ],
  }),
  component: ExperienceLabPage,
});

function ExperienceLabPage() {
  const [activeSlug, setActiveSlug] = useState(experienceLevels[0]!.slug);
  const active = experienceLevels.find((l) => l.slug === activeSlug) ?? experienceLevels[0]!;

  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Experience Lab"
          title="Same business. Five experiences. Judge for yourself."
          lead="Most agencies describe website levels in adjectives. We built the same fictional business — Aurelia Ridge, a hillside residential development — five separate times, and put every version live on this page."
        />
        <div className="mt-6 flex flex-wrap gap-2">
          <Pill>Real working demos</Pill>
          <Pill>Identical content, different capability</Pill>
          <Pill>Heavy experiences load on demand</Pill>
        </div>
      </Section>

      <Section className="pt-0">
        <div
          role="tablist"
          aria-label="Website experience levels"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {experienceLevels.map((level) => (
            <button
              key={level.slug}
              role="tab"
              type="button"
              aria-selected={level.slug === activeSlug}
              onClick={() => setActiveSlug(level.slug)}
              className={cn(
                "shrink-0 rounded-lg border px-4 py-3 text-left transition-colors",
                level.slug === activeSlug
                  ? "border-signal bg-signal/10"
                  : "border-border bg-card hover:border-signal/50",
              )}
            >
              <span className="block font-mono text-[11px] text-signal">{level.index}</span>
              <span className="mt-0.5 block font-display text-sm font-semibold">{level.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <DemoFrame
            key={active.slug}
            src={active.demoPath}
            title={`${active.name} website demo`}
            heavy={active.heavy}
          />

          <aside>
            <p className="eyebrow">{active.index} — {active.name}</p>
            <h2 className="mt-3 font-display text-2xl font-semibold">{active.headline}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{active.oneLiner}</p>

            <p className="mt-6 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Indicative price
            </p>
            <p className="font-display text-xl font-semibold">{active.price}</p>
            <p className="mt-1 text-xs text-muted-foreground">Typical delivery {active.timeline}</p>

            <p className="mt-6 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Best for</p>
            <p className="text-sm">{active.whoFor.join(" · ")}</p>

            <p className="mt-6 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">What you get</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {active.includes.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-lg border border-border bg-secondary/60 p-4">
              <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                Why a business picks this
              </p>
              <p className="mt-2 text-sm">{active.businessImpact}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {active.techniques.map((t) => (
                <span key={t} className="rounded-md bg-secondary px-2.5 py-1 font-mono text-[11px]">
                  {t}
                </span>
              ))}
            </div>

            {active.note ? <p className="mt-4 text-xs text-muted-foreground italic">{active.note}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/start-project"
                className="inline-flex items-center rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-signal-foreground"
              >
                Estimate this level
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center rounded-md border border-border px-4 py-2.5 text-sm font-medium"
              >
                Talk it through
              </Link>
            </div>
          </aside>
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Comparison"
          title="What actually changes between levels"
          lead="Capability, not vocabulary. Every level below includes everything from the level above it in the list."
        />
        <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Capability
                </th>
                {experienceLevels.map((l) => (
                  <th key={l.slug} scope="col" className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    <span className="block font-mono text-[11px] text-signal">{l.index}</span>
                    {l.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonMatrix.map((row) => (
                <tr key={row.capability} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-muted-foreground">
                    {row.capability}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={`${row.capability}-${i}`} className="px-4 py-3">
                      {v === "Yes" ? (
                        <Check className="h-4 w-4 text-signal" aria-label="Included" />
                      ) : v === "—" ? (
                        <Minus className="h-4 w-4 text-muted-foreground/50" aria-label="Not included" />
                      ) : (
                        <span className="whitespace-nowrap">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Not sure"
          title="Three questions, one recommendation"
          lead="Answer honestly about your business rather than your ambition. The suggestion below updates as you go."
        />
        <LevelGuide onPick={setActiveSlug} />
      </Section>

      <CTASection
        title="Pick a level and we will scope it properly"
        body="Tell us which experience felt right and what your business does. You get a scoped proposal, not a brochure."
      />
    </>
  );
}

function LevelGuide({ onPick }: { onPick: (slug: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const result = useMemo(() => {
    const totals = [0, 0, 0, 0, 0];
    let answered = 0;
    for (const q of guideQuestions) {
      const idx = answers[q.id];
      if (idx === undefined) continue;
      answered += 1;
      const opt = q.options[idx];
      if (!opt) continue;
      opt.weights.forEach((w, i) => {
        totals[i] = (totals[i] ?? 0) + w;
      });
    }
    if (answered === 0) return null;
    let best = 0;
    totals.forEach((t, i) => {
      if (t > (totals[best] ?? 0)) best = i;
    });
    return { level: experienceLevels[best]!, complete: answered === guideQuestions.length };
  }, [answers]);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {guideQuestions.map((q, qi) => (
          <fieldset key={q.id} className="rounded-xl border border-border bg-card p-5">
            <legend className="px-1 font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
              Question {qi + 1}
            </legend>
            <p className="font-display text-lg font-medium">{q.question}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    answers[q.id] === oi ? "border-signal bg-signal/10 font-medium" : "border-border hover:border-signal/50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="h-fit rounded-xl border border-ink-border bg-ink p-6 lg:sticky lg:top-24">
        <p className="font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase">Suggested level</p>
        {result ? (
          <>
            <p className="mt-3 font-display text-2xl font-semibold text-ink-foreground">
              {result.level.index} {result.level.name}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{result.level.oneLiner}</p>
            <p className="mt-4 font-display text-lg text-ink-foreground">{result.level.price}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {result.complete ? "Based on all three answers." : "Preliminary — answer the rest to refine."}
            </p>
            <button
              type="button"
              onClick={() => {
                onPick(result.level.slug);
                if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="mt-5 w-full rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-signal-foreground"
            >
              View this demo
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Answer the first question and a recommendation will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
