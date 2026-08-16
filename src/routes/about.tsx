import { createFileRoute } from "@tanstack/react-router";
import { Pill, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { capabilityStack, process } from "@/data/solutions";
import { StepList } from "@/components/site/cards";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — A Practical Technology Partner | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Tharigopula Technologies builds websites, software, dashboards, automation and AI around how businesses actually operate — outcomes first, technology second.",
      },
      { property: "og:title", content: "About Tharigopula Technologies" },
      { property: "og:description", content: "How we think, how we work, and what we care about." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="About"
          title="Technology should reduce work, not add to it"
          lead="We are a technology partner for businesses that have outgrown spreadsheets, scattered tools and manual follow-ups — and want systems that fit how they already work."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Business first", "We spend the first conversation on your workflow, not our stack. The right build is the one that removes real friction."],
            ["Built to be used", "Software only pays off when your team adopts it. Clear screens, sensible defaults, minimal training."],
            ["Long-term thinking", "Systems are designed to grow — new modules, new data, new automation — without a rebuild."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">{t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading eyebrow="How we work" title="A process built around clarity" />
        <div className="mt-10">
          <StepList items={process} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Capabilities" title="What we work with" />
        <ul className="mt-8 flex flex-wrap gap-2">
          {capabilityStack.map((c) => (
            <li key={c.title}>
              <Pill>{c.title}</Pill>
            </li>
          ))}
        </ul>
      </Section>

      <CTASection />
    </>
  );
}
