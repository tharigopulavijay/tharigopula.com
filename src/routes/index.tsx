import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Container, Section, SectionHeading } from "@/components/site/primitives";
import { SystemFlow } from "@/components/site/SystemFlow";
import {
  FeatureGrid,
  IndustryCard,
  ProjectCard,
  SolutionCard,
  StepList,
} from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { EstimatorTeaser } from "@/components/site/EstimatorTeaser";
import { problemEntries, process, solutionGroups, whyPoints } from "@/data/solutions";
import { industries } from "@/data/industries";
import { caseStudies } from "@/data/portfolio";
import { websiteCategories } from "@/data/templates";
import { experienceLevels } from "@/data/experience-lab";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tharigopula Technologies — Technology built around your business" },
      {
        name: "description",
        content:
          "Websites, business software, automation, dashboards and AI. We understand how your business works first, then build the system it actually needs.",
      },
      {
        property: "og:title",
        content: "Tharigopula Technologies — Technology built around your business",
      },
      {
        property: "og:description",
        content:
          "Websites. Software. Data. Automation. AI. One technology partner for growing businesses.",
      },
    ],
  }),
  component: Home,
});

/**
 * Facts a visitor can verify, not claims they have to take on trust.
 * Deliberately no client counts or years-in-business — an early practice that
 * quotes numbers invites the reader to weigh them, and silence reads stronger
 * than a small figure.
 */
const HERO_MARKERS = [
  { label: "Business-first approach", icon: <MarkerTarget /> },
  { label: "Custom & scalable", icon: <MarkerBlocks /> },
  { label: "Built in Hyderabad, India", icon: <MarkerPin /> },
];

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/60 to-background">
      <Container className="relative py-14 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="reveal">
            <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Technology built
              <br />
              around <span className="text-signal">your business.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tharigopula builds websites, business software, automation, dashboards and AI around
              how your business actually works — starting with one problem, not a platform.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/experience-lab"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
              >
                See live demos <span aria-hidden>→</span>
              </Link>
              <Link
                to="/start-project"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
              >
                Get project estimate
              </Link>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
              {HERO_MARKERS.map((m) => (
                <li key={m.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-signal" aria-hidden>
                    {m.icon}
                  </span>
                  {m.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal" style={{ animationDelay: "120ms" }}>
            <SystemFlow />
          </div>
        </div>
      </Container>
    </section>
  );
}

function markerSvg(children: React.ReactNode) {
  return (
    <svg
      width="16"
      height="16"
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
function MarkerTarget() {
  return markerSvg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>,
  );
}
function MarkerBlocks() {
  return markerSvg(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 6.5h7M6.5 14v7" />
    </>,
  );
}
function MarkerPin() {
  return markerSvg(
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>,
  );
}

function ProblemEntry() {
  const [active, setActive] = useState(problemEntries[0]!.slug);
  const group = solutionGroups.find((g) => g.slug === active)!;

  return (
    <Section>
      <SectionHeading
        eyebrow="Start here"
        title="What are you trying to improve?"
        lead="Most businesses do not start with a technology name. They start with something that is not working."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {problemEntries.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setActive(p.slug)}
              aria-pressed={active === p.slug}
              className={cn(
                "rounded-lg border px-4 py-4 text-left transition-all",
                active === p.slug
                  ? "border-signal bg-signal/10"
                  : "border-border bg-card hover:-translate-y-0.5 hover:shadow-lift",
              )}
            >
              <span className="block font-display text-base font-semibold">{p.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{p.description}</span>
            </button>
          ))}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SolutionCard group={group} />
          <Link
            to="/solutions"
            hash={group.slug}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:text-signal"
          >
            See everything in {group.title} <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </Section>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <ProblemEntry />

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Solutions"
          title="Six capability groups, one partner"
          lead="Most businesses need two or three of these. Very few need all six on day one — and we will tell you which."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {solutionGroups.map((g) => (
            <SolutionCard key={g.slug} group={g} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Industries"
          title="What could technology improve in your type of business?"
          lead="Each industry has its own version of the same problems. Start with yours."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.slice(0, 6).map((i) => (
            <IndustryCard key={i.slug} industry={i} />
          ))}
        </div>
        <Link
          to="/industries"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium hover:text-signal"
        >
          View all {industries.length} industries <span aria-hidden>→</span>
        </Link>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Featured work"
          title="Systems worked through, problem first"
          lead="Each one says plainly whether it is a delivered client system or a solution designed to show the approach."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.slice(0, 3).map((c) => (
            <ProjectCard key={c.slug} study={c} />
          ))}
        </div>
        <Link
          to="/portfolio"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium hover:text-signal"
        >
          View portfolio <span aria-hidden>→</span>
        </Link>
      </Section>

      {/* One proof section instead of three. Website levels, template directions
          and the working platform demo all answer the same visitor question:
          "can you actually show me?" */}
      <Section ink>
        <SectionHeading
          ink
          eyebrow="See it working"
          title="Everything below is live. Click it."
          lead="Most agencies describe what they can build. We built the same fictional business five different ways, plus a working business platform, and put all of it on this site."
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {experienceLevels.map((l) => (
            <div key={l.slug} className="rounded-lg border border-ink-border p-4">
              <p className="font-mono text-[11px] text-signal">{l.index}</p>
              <p className="mt-1 font-display font-semibold text-ink-foreground">{l.name}</p>
              <p className="mt-2 text-xs text-ink-muted">{l.price}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/experience-lab"
            className="rounded-md bg-signal px-5 py-3 text-center text-sm font-medium text-signal-foreground"
          >
            Compare the five website levels
          </Link>
          <Link
            to="/demo/platform"
            className="rounded-md border border-ink-border px-5 py-3 text-center text-sm font-medium text-ink-foreground transition-colors hover:bg-white/5"
          >
            Try the business platform
          </Link>
          <Link
            to="/website-studio"
            className="rounded-md px-5 py-3 text-center text-sm font-medium text-ink-muted hover:text-ink-foreground"
          >
            Browse {websiteCategories.length} website styles
          </Link>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="How we work"
          title="We do not sell websites. We solve a business problem and then build what fits."
          lead="The same path whether it ends in a five-page website or a multi-module platform — and you can follow it without a technical background."
        />
        <div className="mt-10">
          <StepList items={process} />
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Why Tharigopula"
          title="Practical technology, delivered transparently"
        />
        <div className="mt-10">
          <FeatureGrid items={whyPoints} />
        </div>
      </Section>

      <Section id="estimator">
        <SectionHeading
          eyebrow="Indicative pricing"
          title="Find out roughly what it costs"
          lead="Before you talk to anyone. The configurator gives a range and writes out what is included."
        />
        <div className="mt-10">
          <EstimatorTeaser />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
