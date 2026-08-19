import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { FeatureGrid, SolutionCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { capabilityStack, solutionGroups } from "@/data/solutions";

export const Route = createFileRoute("/solutions")({
  head: () => ({
    meta: [
      { title: "Solutions — Websites, Software, Automation, Data & AI | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Digital presence, custom business software, automation, dashboards, AI solutions and applications — built around how your business actually operates.",
      },
      { property: "og:title", content: "Solutions | Tharigopula Technologies" },
      {
        property: "og:description",
        content:
          "Websites, CRM, ERP-style systems, automation, dashboards and AI for growing businesses.",
      },
    ],
  }),
  component: SolutionsPage,
});

function SolutionsPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Solutions"
          title="Everything a growing business usually needs, from one partner"
          lead="We start from the business problem. The technology follows — and never the other way round."
        />
      </Section>
      <Section className="pt-0">
        <div className="grid gap-5 md:grid-cols-2">
          {solutionGroups.map((g) => (
            <SolutionCard key={g.slug} group={g} />
          ))}
        </div>
      </Section>
      <Section className="bg-secondary/40">
        <SectionHeading eyebrow="Capabilities" title="What we bring to a project" />
        <div className="mt-10">
          <FeatureGrid items={capabilityStack} />
        </div>
      </Section>
      <CTASection />
    </>
  );
}
