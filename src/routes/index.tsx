import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/site/primitives";
import { SystemMap } from "@/components/site/SystemMap";
import { FeatureGrid, IndustryCard, ProjectCard, SolutionCard, StepList, TemplateCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { Estimator } from "@/components/site/Estimator";
import { deliveryJourney, problemEntries, process, solutionGroups, techCapabilities, whyPoints } from "@/data/solutions";
import { industries } from "@/data/industries";
import { caseStudies } from "@/data/portfolio";
import { templates, websiteCategories } from "@/data/templates";
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
      { property: "og:title", content: "Tharigopula Technologies — Technology built around your business" },
      {
        property: "og:description",
        content: "Websites. Software. Data. Automation. AI. One technology partner for growing businesses.",
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
              From websites and business software to automation, data and AI — we design technology that helps
              businesses operate better and grow faster.
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

function Journey() {
  return (
    <Section ink>
      <SectionHeading
        ink
        eyebrow="How a solution takes shape"
        title="We do not sell websites. We solve a business problem and then build what fits."
        lead="Every engagement follows the same path, whether it ends in a five-page website or a multi-module platform."
      />
      <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-ink-border bg-white/10 sm:grid-cols-3">
        {deliveryJourney.map((s, i) => (
          <li key={s.step} className="surface-ink p-5">
            <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-2 font-display text-base font-semibold text-ink-foreground">{s.step}</p>
            <p className="mt-1 text-sm text-ink-muted">{s.note}</p>
          </li>
        ))}
      </ol>
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

      <Journey />

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
        <Link to="/industries" className="mt-8 inline-flex items-center gap-2 text-sm font-medium hover:text-signal">
          View all {industries.length} industries <span aria-hidden>→</span>
        </Link>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading eyebrow="Featured work" title="Systems built around real business problems" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.slice(0, 3).map((c) => (
            <ProjectCard key={c.slug} study={c} />
          ))}
        </div>
        <Link to="/portfolio" className="mt-8 inline-flex items-center gap-2 text-sm font-medium hover:text-signal">
          View portfolio <span aria-hidden>→</span>
        </Link>
      </Section>

      <Section ink>
        <SectionHeading
          ink
          eyebrow="Experience Lab"
          title="One business, built five different ways — all live"
          lead="Essential, Dynamic, Interactive, Cinematic and 3D Immersive. Instead of describing the difference, we built the same fictional business at every level so you can scroll through them yourself."
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
        <Link
          to="/experience-lab"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-medium text-signal-foreground"
        >
          Open the Experience Lab <span aria-hidden>→</span>
        </Link>
      </Section>



      <Section>
        <SectionHeading
          eyebrow="Website Studio"
          title="Choose how your business should appear online"
          lead={`Five levels of website experience, from a fast essential site to full 3D. ${websiteCategories.length} categories, each with indicative pricing.`}
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.slice(0, 3).map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
        <Link to="/website-studio" className="mt-8 inline-flex items-center gap-2 text-sm font-medium hover:text-signal">
          Explore website styles <span aria-hidden>→</span>
        </Link>
      </Section>

      <Section className="bg-secondary/40" id="estimator">
        <SectionHeading
          eyebrow="Project estimator"
          title="Build your project"
          lead="Eight quick steps. You get an indicative range, a suggested direction and a relevant case study."
        />
        <div className="mt-10">
          <Estimator compact />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="How we work" title="A process you can follow without a technical background" />
        <div className="mt-10">
          <StepList items={process} />
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading eyebrow="Why Tharigopula" title="Practical technology, delivered transparently" />
        <div className="mt-10">
          <FeatureGrid items={whyPoints} />
        </div>
      </Section>

      <Section ink>
        <SectionHeading ink eyebrow="Technology capabilities" title="The stack behind the business outcomes" />
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-ink-border bg-white/10 sm:grid-cols-2">
          {Object.entries(techCapabilities).map(([group, items]) => (
            <div key={group} className="surface-ink p-6">
              <p className="font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase">{group}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {items.map((i) => (
                  <li key={i} className="rounded-md border border-ink-border px-2.5 py-1 text-xs text-ink-foreground/85">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <CTASection />
    </>
  );
}
