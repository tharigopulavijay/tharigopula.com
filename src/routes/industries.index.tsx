import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { IndustryCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { industries } from "@/data/industries";

export const Route = createFileRoute("/industries/")({
  head: () => ({
    meta: [
      { title: "Industry Solutions — Manufacturing, Healthcare, Retail & more | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Explore what technology can improve in your industry: manufacturing, clinics, restaurants, finance, real estate, retail, logistics and more.",
      },
      { property: "og:title", content: "Industry Solutions | Tharigopula Technologies" },
      { property: "og:description", content: "Common challenges and practical solutions for 13 industries." },
    ],
  }),
  component: IndustriesPage,
});

function IndustriesPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Industry explorer"
          title="What could technology improve in your type of business?"
          lead="Pick your industry to see the problems we usually find, and the systems that solve them."
        />
      </Section>
      <Section className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((i) => (
            <IndustryCard key={i.slug} industry={i} />
          ))}
        </div>
      </Section>
      <CTASection title="Not sure which of these fits you?" body="Describe your business in two lines. We will tell you where technology would help first." />
    </>
  );
}
