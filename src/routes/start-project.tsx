import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { Estimator } from "@/components/site/Estimator";
import { industryBySlug } from "@/data/industries";

type StartSearch = { industry?: string | undefined; base?: string | undefined };

export const Route = createFileRoute("/start-project")({
  // Lets industry pages, case studies and the platform demo hand off with the
  // visitor's context already known, so they do not answer the same question twice.
  validateSearch: (search: Record<string, unknown>): StartSearch => ({
    industry: typeof search["industry"] === "string" ? search["industry"] : undefined,
    base: typeof search["base"] === "string" ? search["base"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Project Configurator — Get An Indicative Estimate | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Answer a few guided questions about your project type, features and business size to receive an indicative price and timeline range.",
      },
      { property: "og:title", content: "Project Configurator | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Build your project scope step by step and see an indicative range.",
      },
    ],
  }),
  component: StartProjectPage,
});

function StartProjectPage() {
  const { industry, base } = Route.useSearch();
  const known = industry ? industryBySlug(industry) : undefined;

  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Project configurator"
        title="Build your project, step by step"
        lead={
          known
            ? `We have set the industry to ${known.name}. Change anything you like — you get an indicative range and a summary we can start from.`
            : "A few questions about what you need. You get an indicative range and a summary we can start from."
        }
      />
      <div className="mt-10">
        <Estimator initialIndustry={industry} initialBase={base} />
      </div>
    </Section>
  );
}
