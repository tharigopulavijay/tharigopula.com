import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { PlatformDemo } from "@/components/demo/PlatformDemo";

export const Route = createFileRoute("/demo/platform")({
  head: () => ({
    meta: [
      { title: "Business Platform Demo | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "A working business platform you can click through — CRM, inventory, billing, service and automation. Switch the business type and every screen changes to match your industry.",
      },
      { property: "og:title", content: "Business Platform Demo | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Six industries, one platform. See your own business running before you commit to anything.",
      },
    ],
  }),
  component: PlatformDemoPage,
});

const MODULE_NOTES = [
  { title: "Dashboard", body: "The numbers that matter, without waiting for month-end." },
  { title: "Pipeline", body: "Every enquiry visible, with a stage and an owner. Click a card to move it." },
  { title: "Inventory", body: "Live stock position with reorder alerts before you run out." },
  { title: "Billing", body: "One ledger for what was sold and what has actually been collected." },
  { title: "Service", body: "Jobs, complaints and follow-ups that stop living in someone's head." },
  { title: "Automation", body: "Press the button in that tab and watch an enquiry handle itself." },
];

function PlatformDemoPage() {
  return (
    <>
      <section className="surface-ink">
        <Container className="py-14 sm:py-20">
          <SectionHeading
            ink
            as="h1"
            eyebrow="Live demo · Business software"
            title="Your business, running — before you spend anything"
            lead="This is a real, working platform, not a screenshot. Pick your industry at the top and every screen below re-populates with your world: a clinic sees patients and appointments, a manufacturer sees dealers and orders."
          />
        </Container>
      </section>

      <Section>
        <PlatformDemo />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_NOTES.map((m) => (
            <div key={m.title} className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">{m.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-border bg-secondary/50 p-6">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            What a system like this costs
          </p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Most businesses do not start with all six modules. A single module — usually enquiries
            or billing — goes live first, and the rest follow once the team is comfortable. We scope
            it that way on purpose, so you see value before the full spend.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/start-project"
              className="rounded-md bg-ink px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground"
            >
              Get this scoped for my business
            </Link>
            <Link
              to="/pricing"
              className="rounded-md border border-border px-5 py-3.5 text-center text-sm font-semibold"
            >
              See software pricing
            </Link>
          </div>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
