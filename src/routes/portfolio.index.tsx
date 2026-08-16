import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { caseStudies } from "@/data/portfolio";

export const Route = createFileRoute("/portfolio/")({
  head: () => ({
    meta: [
      { title: "Portfolio — Business Systems, Platforms & Case Studies | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Case studies covering manufacturing systems, clinic platforms, restaurant customer platforms, finance lead engines, veterinary ecosystems and farm technology.",
      },
      { property: "og:title", content: "Portfolio | Tharigopula Technologies" },
      { property: "og:description", content: "Problem, solution, architecture and outcome for every project." },
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
          title="Case studies, not screenshots"
          lead="Each project starts with what was not working in the business, and ends with what changed."
        />
      </Section>
      <Section className="pt-0">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.map((c) => (
            <ProjectCard key={c.slug} study={c} />
          ))}
        </div>
      </Section>
      <CTASection title="Build a similar solution" body="If one of these sounds like your situation, the starting point is a short conversation about your workflow." />
    </>
  );
}
