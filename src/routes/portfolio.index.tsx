import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { ProjectStatusBadge } from "@/components/site/ProjectStatusBadge";
import { caseStudies } from "@/data/portfolio";
import { statusMeta, type ProjectStatus } from "@/data/project-status";

/** Only explain the labels actually in use, so the legend never lists a status nothing has. */
const usedStatuses = [...new Set(caseStudies.map((c) => c.status))] as ProjectStatus[];

export const Route = createFileRoute("/portfolio/")({
  head: () => ({
    meta: [
      {
        title: "Portfolio — Business Systems, Platforms & Case Studies | Tharigopula Technologies",
      },
      {
        name: "description",
        content:
          "Case studies covering manufacturing systems, clinic platforms, restaurant customer platforms, finance lead engines, veterinary ecosystems and farm technology.",
      },
      { property: "og:title", content: "Portfolio | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Problem, solution, architecture and outcome for every project.",
      },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Portfolio"
          title="How we would build it, worked through in full"
          lead="Each of these starts with what is not working in a business, and works through the data model, workflow, screens and automation it would take to fix. Every project says plainly what it is — a delivered client system or a worked concept."
        />
      </Section>

      <Section className="pt-0">
        {/* A legend, because a label only builds trust if its meaning is stated. */}
        <div className="rounded-xl border border-border bg-secondary/40 p-5">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            What the labels mean
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usedStatuses.map((s) => (
              <div key={s} className="flex flex-col gap-2">
                <dt>
                  <ProjectStatusBadge status={s} />
                </dt>
                <dd className="text-sm text-muted-foreground">{statusMeta(s).meaning}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.map((c) => (
            <ProjectCard key={c.slug} study={c} />
          ))}
        </div>
      </Section>
      <CTASection
        title="Build a similar solution"
        body="If one of these sounds like your situation, the starting point is a short conversation about your workflow."
      />
    </>
  );
}
