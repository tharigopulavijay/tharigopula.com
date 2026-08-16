import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeading } from "@/components/site/primitives";
import { Estimator } from "@/components/site/Estimator";

export const Route = createFileRoute("/start-project")({
  head: () => ({
    meta: [
      { title: "Project Configurator — Get An Indicative Estimate | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Answer a few guided questions about your project type, features and business size to receive an indicative price and timeline range.",
      },
      { property: "og:title", content: "Project Configurator | Tharigopula Technologies" },
      { property: "og:description", content: "Build your project scope step by step and see an indicative range." },
    ],
  }),
  component: StartProjectPage,
});

function StartProjectPage() {
  return (
    <Section>
      <SectionHeading
        as="h1"
        eyebrow="Project configurator"
        title="Build your project, step by step"
        lead="A few questions about what you need. You get an indicative range and a summary we can start from."
      />
      <div className="mt-10">
        <Estimator />
      </div>
    </Section>
  );
}
