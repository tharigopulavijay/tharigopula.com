import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Container, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { PlatformDemo } from "@/components/demo/PlatformDemo";
import { businessBySlug } from "@/data/demo-platform";
import { demoForIndustry } from "@/data/demo-routing";
import { industryBySlug } from "@/data/industries";
import { playbookFor } from "@/data/industry-playbook";
import { whatsappLink } from "@/data/site";

type DemoSearch = { industry?: string | undefined };

export const Route = createFileRoute("/demo/platform")({
  validateSearch: (search: Record<string, unknown>): DemoSearch => ({
    industry: typeof search["industry"] === "string" ? search["industry"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Business Platform Demo | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "A working business platform you can click through — enquiries, inventory, billing, service and automation. Opens configured for your industry.",
      },
      { property: "og:title", content: "Business Platform Demo | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "See your own business running before you commit to anything.",
      },
    ],
  }),
  component: PlatformDemoPage,
});

const MODULE_NOTES = [
  { title: "Dashboard", body: "The numbers that matter, without waiting for month-end." },
  {
    title: "Pipeline",
    body: "Every enquiry visible, with a stage and an owner. Click a card to move it.",
  },
  { title: "Inventory", body: "Live stock position with reorder alerts before you run out." },
  { title: "Billing", body: "One ledger for what was sold and what has actually been collected." },
  { title: "Service", body: "Jobs, complaints and follow-ups that stop living in someone's head." },
  { title: "Automation", body: "Press the button in that tab and watch an enquiry handle itself." },
];

function PlatformDemoPage() {
  const { industry: industrySlug } = Route.useSearch();
  const industry = industrySlug ? industryBySlug(industrySlug) : undefined;
  const match = industrySlug ? demoForIndustry(industrySlug) : undefined;
  const playbook = industrySlug ? playbookFor(industrySlug) : undefined;

  // Tracks the demo's own switcher so the CTAs below never contradict what is
  // on screen after a visitor changes industry inside the demo.
  const [activeBusiness, setActiveBusiness] = useState(match?.business);
  const shown = businessBySlug(activeBusiness ?? match?.business ?? "");

  return (
    <>
      <section className="surface-ink">
        <Container className="py-14 sm:py-20">
          <SectionHeading
            ink
            as="h1"
            eyebrow={industry ? `Live demo · ${industry.name}` : "Live demo · Business software"}
            title={
              industry
                ? `This is roughly what ${industry.name.toLowerCase()} looks like running on a system`
                : "Your business, running — before you spend anything"
            }
            lead={
              industry
                ? "Not a screenshot. Click through it — move an enquiry, check the stock position, run the automation. Every screen holds data from this kind of business."
                : "This is a real, working platform, not a screenshot. Pick your industry at the top and every screen re-populates with your world."
            }
          />

          {match && !match.exact && match.note ? (
            <div className="mt-8 max-w-2xl rounded-lg border border-ink-border bg-white/5 p-5">
              <p className="font-mono text-[10px] tracking-[0.16em] text-ink-muted uppercase">
                About this demo
              </p>
              <p className="mt-2 text-sm text-ink-foreground/85">{match.note}</p>
            </div>
          ) : null}
        </Container>
      </section>

      <Section>
        <PlatformDemo initialBusiness={match?.business} onBusinessChange={setActiveBusiness} />

        <p className="mt-4 text-sm text-muted-foreground">
          Every name, number and record here is representative sample data, not a real customer.
        </p>

        {/* The funnel: demo -> configure -> talk. Carries the industry across. */}
        <div className="mt-8 rounded-xl border border-border bg-secondary/50 p-6">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Next step
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            {industry
              ? `Configure something like this for ${industry.name.toLowerCase()}`
              : "Configure this for your business"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {playbook
              ? playbook.objective
              : "Most businesses start with one module, not six. Answer a few questions and you get an indicative range with the scope written out."}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/start-project"
              search={industrySlug ? { industry: industrySlug } : {}}
              className="rounded-md bg-ink px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground"
            >
              Get an indicative estimate
            </Link>
            <a
              href={whatsappLink(
                shown
                  ? `Hello Tharigopula Technologies. I looked at the ${shown.industry} platform demo and would like to discuss something similar for my business.`
                  : "Hello Tharigopula Technologies, I would like to discuss a business system.",
              )}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-5 py-3.5 text-center text-sm font-semibold"
            >
              Discuss on WhatsApp
            </a>
            {industry ? (
              <Link
                to="/industries/$slug"
                params={{ slug: industry.slug }}
                className="rounded-md px-5 py-3.5 text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Back to {industry.name}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_NOTES.map((m) => (
            <div key={m.title} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-base font-semibold">{m.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <CTASection />
    </>
  );
}
