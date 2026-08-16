import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Container, Pill, Section, SectionHeading } from "@/components/site/primitives";
import { ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { industries, industryBySlug } from "@/data/industries";
import { caseStudies } from "@/data/portfolio";

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

  return (
    <>
      <section className="surface-ink">
        <Container className="py-14 sm:py-20">
          <SectionHeading ink as="h1" eyebrow={`Industry · ${industry.name}`} title={industry.tagline} />
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

      {related.length ? (
        <Section className="bg-secondary/40">
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
