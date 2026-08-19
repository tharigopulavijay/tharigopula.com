import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Container, Pill, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { caseStudyBySlug } from "@/data/portfolio";

export const Route = createFileRoute("/portfolio/$slug")({
  loader: ({ params }) => {
    const study = caseStudyBySlug(params.slug);
    if (!study) throw notFound();
    return { study };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return { meta: [{ title: "Case study not found" }, { name: "robots", content: "noindex" }] };
    const s = loaderData.study;
    return {
      meta: [
        { title: `${s.title} | Tharigopula Technologies` },
        { name: "description", content: s.summary },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.summary },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: CaseStudyPage,
});

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {items.map((i) => (
          <li key={i} className="flex gap-3 text-sm text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CaseStudyPage() {
  const { study } = Route.useLoaderData();

  return (
    <>
      <section className="surface-ink">
        <Container className="py-14 sm:py-20">
          <SectionHeading
            ink
            as="h1"
            eyebrow={`${study.client} · ${study.industry}`}
            title={study.title}
            lead={study.summary}
          />
          <ul className="mt-8 flex flex-wrap gap-2">
            {study.tech.map((t) => (
              <li key={t}>
                <Pill ink>{t}</Pill>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <Block title="Business challenge" items={study.challenge} />
          <Block title="Our understanding" items={study.understanding} />
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <div className="grid gap-10 lg:grid-cols-2">
          <Block title="Solution" items={study.solution} />
          <div>
            <h2 className="font-display text-2xl font-semibold">System design</h2>
            <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border">
              {study.architecture.map((a) => (
                <div key={a.layer} className="bg-card p-4">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    {a.layer}
                  </p>
                  <p className="mt-1 text-sm">{a.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold">Key features</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {study.features.map((f) => (
                <li key={f}>
                  <Pill>{f}</Pill>
                </li>
              ))}
            </ul>
            <h2 className="mt-10 font-display text-2xl font-semibold">Screens & experience</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {study.screens.map((s) => (
                <li key={s} className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-10">
            <Block title="Automation" items={study.automation} />
            <Block title="Data & analytics" items={study.analytics} />
          </div>
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <div className="grid gap-10 lg:grid-cols-2">
          <Block title="Outcome" items={study.outcome} />
          <Block title="Possible future improvements" items={study.future} />
        </div>
        {/* Case study -> working demo -> configured estimate, without losing context. */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/demo/platform"
            search={{ industry: study.industrySlug }}
            className="rounded-md bg-signal px-5 py-3.5 text-center text-sm font-semibold text-signal-foreground"
          >
            Try a {study.industry.toLowerCase()} workflow
          </Link>
          <Link
            to="/start-project"
            search={{ industry: study.industrySlug }}
            className="rounded-md bg-ink px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground"
          >
            Configure this for my business
          </Link>
          <Link
            to="/portfolio"
            className="rounded-md border border-border px-5 py-3.5 text-center text-sm font-semibold"
          >
            Back to portfolio
          </Link>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
