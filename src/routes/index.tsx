import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/site/primitives";
import { SystemMap } from "@/components/site/SystemMap";
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

function Hero() {
  return (
    <section className="surface-ink relative overflow-hidden">
      <div className="grid-lines absolute inset-0 opacity-[0.35]" aria-hidden />
      <Container className="relative py-16 sm:py-24 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="reveal">
            <Eyebrow ink>Tharigopula Technologies</Eyebrow>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold text-ink-foreground sm:text-5xl lg:text-6xl">
              Technology built around your business.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              From websites and business software to automation, data and AI — we design technology
              that helps businesses operate better and grow faster.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/solutions"
                className="rounded-md bg-signal px-6 py-3.5 text-center text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
              >
                Explore Solutions
              </Link>
              <Link
                to="/start-project"
                className="rounded-md border border-ink-border px-6 py-3.5 text-center text-sm font-semibold text-ink-foreground transition-colors hover:bg-white/5"
              >
                Start Your Project
              </Link>
            </div>
            <p className="mt-8 font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase">
              Websites · Software · Data · Automation · AI
            </p>
          </div>
          <div className="reveal" style={{ animationDelay: "120ms" }}>
            <SystemMap />
          </div>
        </div>
      </Container>
    </section>
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
