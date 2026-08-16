import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Container, Pill, Section, SectionHeading } from "@/components/site/primitives";
import { ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { industries, industryBySlug } from "@/data/industries";
import { caseStudies } from "@/data/portfolio";
import { playbookFor } from "@/data/industry-playbook";
import { categoryBySlug, demoPathFor } from "@/data/templates";

export const Route = createFileRoute("/industries/$slug")({
  loader: ({ params }) => {
    const industry = industryBySlug(params.slug);
    if (!industry) throw notFound();
    return { industry };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Industry not found" }, { name: "robots", content: "noindex" }] };
    const { industry } = loaderData;
    const title = `${industry.name} Technology Solutions | Tharigopula Technologies`;
    return {
      meta: [
        { title },
        { name: "description", content: industry.tagline },
        { property: "og:title", content: title },
        { property: "og:description", content: industry.tagline },
      ],
    };
  },
  component: IndustryPage,
});

function IndustryPage() {
  const { industry } = Route.useLoaderData();
  const related = caseStudies.filter((c) => c.industrySlug === industry.slug);
  const playbook = playbookFor(industry.slug);

  return (
    <>
      <section className="surface-ink">
        <Container className="py-14 sm:py-20">
          <SectionHeading ink as="h1" eyebrow={`Industry · ${industry.name}`} title={industry.tagline} />
          {playbook ? (
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-ink-border pt-6">
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-ink-muted uppercase">Websites from</p>
                <p className="mt-1 font-display text-xl font-semibold text-ink-foreground">{playbook.startingFrom}</p>
              </div>
              <div className="max-w-md">
                <p className="font-mono text-[10px] tracking-[0.16em] text-ink-muted uppercase">The objective</p>
                <p className="mt-1 text-sm text-ink-foreground/90">{playbook.objective}</p>
              </div>
            </div>
          ) : null}
        </Container>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold">Common challenges</h2>
            <ul className="mt-5 space-y-3">
              {industry.challenges.map((c) => (
                <li key={c} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive/70" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">Possible solutions</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {industry.solutions.map((s) => (
                <li key={s}>
                  <Pill>{s}</Pill>
                </li>
              ))}
            </ul>
            <Link
              to="/start-project"
              className="mt-8 inline-block rounded-md bg-ink px-5 py-3.5 text-sm font-semibold text-ink-foreground"
            >
              Build a system for my business
            </Link>
          </div>
        </div>
      </Section>

      {playbook ? (
        <>
          <Section className="bg-secondary/40">
            <SectionHeading
              eyebrow="Where to start"
              title="Website levels that suit this industry"
              lead="Not every business needs the top level. These are the ones that genuinely fit — each has a live demo you can open."
            />
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {playbook.levels.map((slug) => {
                const category = categoryBySlug(slug);
                if (!category) return null;
                return (
                  <div key={slug} className="flex h-full flex-col rounded-xl border border-border bg-card p-6">
                    <h3 className="font-display text-lg font-semibold">{category.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{category.headline}</p>
                    <p className="mt-4 text-sm font-medium">{category.priceRange}</p>
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                      <a
                        href={demoPathFor(slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:border-signal hover:text-signal"
                      >
                        See it live
                      </a>
                      <Link
                        to="/website-studio"
                        className="rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        Compare all
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Functionality this industry actually uses
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {playbook.functionality.map((f) => (
                  <li key={f}>
                    <Pill>{f}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          <Section>
            <SectionHeading
              eyebrow="Automation"
              title="Work that should not need a person every day"
              lead="Each of these runs by itself once set up. Simple automations start at ₹4,999."
            />
            <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {playbook.automations.map((a) => (
                <li key={a.trigger} className="bg-card p-6">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">When</p>
                  <p className="mt-1.5 font-display text-base font-semibold">{a.trigger}</p>
                  <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-signal uppercase">Then, automatically</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{a.outcome}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/demo/platform"
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-signal px-5 py-3.5 text-sm font-semibold text-signal-foreground"
              >
                Watch an automation run
              </a>
              <Link to="/pricing" className="rounded-md border border-border px-5 py-3.5 text-sm font-semibold">
                Automation pricing
              </Link>
            </div>
          </Section>

          <Section className="bg-secondary/40">
            <SectionHeading
              eyebrow="You may also need"
              title="What usually follows the website"
              lead="Most businesses start with one problem. These are the systems that tend to matter next — added to the same foundation, not rebuilt."
            />
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {playbook.systems.map((s) => (
                <div key={s.name} className="flex h-full flex-col rounded-xl border border-border bg-card p-6">
                  <h3 className="font-display text-lg font-semibold">{s.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                  <p className="mt-auto border-t border-border pt-4 text-sm font-medium">{s.from}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
              You do not need all of this on day one. Solve the immediate problem first, and add the rest as the
              business needs it.
            </p>
          </Section>
        </>
      ) : null}

      {related.length ? (
        <Section>
          <SectionHeading eyebrow="Relevant work" title={`What we have built for ${industry.name.toLowerCase()}`} />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {related.map((c) => (
              <ProjectCard key={c.slug} study={c} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section>
        <SectionHeading eyebrow="Other industries" title="Explore another sector" />
        <div className="mt-6 flex flex-wrap gap-2">
          {industries
            .filter((i) => i.slug !== industry.slug)
            .map((i) => (
              <Link
                key={i.slug}
                to="/industries/$slug"
                params={{ slug: i.slug }}
                className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-foreground/30"
              >
                {i.name}
              </Link>
            ))}
        </div>
      </Section>

      <CTASection />
    </>
  );
}
