import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Container, Pill, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { DemoFrame } from "@/components/site/DemoFrame";
import { TemplatePreview } from "@/components/site/TemplatePreview";
import {
  categoryBySlug,
  demoPathFor,
  isHeavyCategory,
  templateBySlug,
  templates,
} from "@/data/templates";

export const Route = createFileRoute("/website-studio/$slug")({
  loader: ({ params }) => {
    const template = templateBySlug(params.slug);
    if (!template) throw notFound();
    return { template };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Template not found" }, { name: "robots", content: "noindex" }] };
    const t = loaderData.template;
    const title = `${t.name} Website Style — ${t.priceRange} | Tharigopula Technologies`;
    const description = `${t.recommendedFor} Typical pages, features, complexity, timeline and indicative pricing.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: TemplatePage,
});

function TemplatePage() {
  const { template } = Route.useLoaderData();
  const category = categoryBySlug(template.category);
  const siblings = templates.filter((t) => t.slug !== template.slug && t.category === template.category);

  return (
    <>
      <section className="surface-ink">
        <Container className="py-14 sm:py-20">
          <SectionHeading
            ink
            as="h1"
            eyebrow={`Website Studio · ${category?.name ?? ""}`}
            title={template.name}
            lead={template.recommendedFor}
          />
          <div className="mt-10 overflow-hidden rounded-xl border border-ink-border">
            <TemplatePreview template={template} />
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            A representation of this direction. Below, the same experience level is running live — click
            inside it, resize it, or open it full screen.
          </p>
        </Container>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Live demo"
          title={`See a ${category?.name ?? "this"} website actually working`}
          lead="This is the real experience level running in a browser frame — not a screenshot. Switch between desktop, tablet and mobile, or open it full screen."
        />
        <div className="mt-8">
          <DemoFrame
            src={demoPathFor(template.category)}
            title={`${category?.name ?? template.name} live demo`}
            heavy={isHeavyCategory(template.category)}
          />
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Industry", template.industry],
            ["Style", template.style],
            ["Complexity", template.complexity],
            ["Estimated timeline", template.timeline],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-5">
              <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{k}</dt>
              <dd className="mt-2 font-display text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold">Typical pages</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {template.pages.map((p) => (
                <li key={p}>
                  <Pill>{p}</Pill>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">Available features</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {template.features.map((f) => (
                <li key={f}>
                  <Pill>{f}</Pill>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-secondary/50 p-6">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Indicative price range</p>
          <p className="mt-2 font-display text-3xl font-semibold">{template.priceRange}</p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Start with a direction you like. We customise the design, content, workflows and functionality around your
            business — the final scope decides the final price.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/start-project" className="rounded-md bg-ink px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground">
              Build something like this
            </Link>
            <Link to="/website-studio" className="rounded-md border border-border px-5 py-3.5 text-center text-sm font-semibold">
              Back to Website Studio
            </Link>
          </div>
        </div>
      </Section>

      {siblings.length ? (
        <Section className="bg-secondary/40">
          <SectionHeading eyebrow="Similar directions" title={`More ${category?.name.toLowerCase()} styles`} />
          <div className="mt-6 flex flex-wrap gap-2">
            {siblings.map((t) => (
              <Link
                key={t.slug}
                to="/website-studio/$slug"
                params={{ slug: t.slug }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-foreground/30"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <CTASection />
    </>
  );
}
