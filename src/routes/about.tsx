import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { capabilityStack } from "@/data/solutions";
import { site, whatsappLink } from "@/data/site";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Who You Are Actually Working With | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Tharigopula Technologies is a lean, founder-led technology partner in Hyderabad building websites, software, automation and AI around how businesses already work.",
      },
      { property: "og:title", content: "About Tharigopula Technologies" },
      {
        property: "og:description",
        content: "How engagements work, what you own, and who you will actually be dealing with.",
      },
    ],
  }),
  component: AboutPage,
});

/**
 * How an engagement actually runs, in commercial terms rather than build steps.
 * The delivery process lives on the homepage; repeating it here told a visitor
 * nothing new. What they want to know at this point is what they are signing up
 * for — who does the work, what it costs, and what happens when it is finished.
 */
const ENGAGEMENT = [
  {
    q: "Who will I actually be dealing with?",
    a: "The person who scopes your project is the person who builds it. There is no account manager relaying messages to a delivery team, and nothing is passed to a subcontractor without telling you.",
  },
  {
    q: "How do you charge?",
    a: "A fixed range agreed before work starts, based on a written scope. The configurator on this site gives you that range before you speak to anyone. If scope changes mid-project, the price change is quoted and agreed first — never invoiced as a surprise.",
  },
  {
    q: "What do I own at the end?",
    a: "The code, the data, the domain and the hosting accounts. Everything is deployed into infrastructure in your name where possible, so you are never locked in. If you stop working with us, nothing stops working.",
  },
  {
    q: "What happens after launch?",
    a: "Support is a monthly plan from ₹999, not a retainer you are pushed into. Plenty of clients take nothing and simply call when something needs changing. Systems are documented so another developer could pick them up.",
  },
  {
    q: "What if my project is small?",
    a: "Small is fine and often smarter. A ₹11,999 website that solves one real problem is a better first step than a platform nobody uses. We would rather build the right small thing and grow it than oversell you a system on day one.",
  },
  {
    q: "How fast do you reply?",
    a: "Within one business day, usually much faster on WhatsApp. If something is urgent and we cannot take it on, we will say so straight away instead of leaving you waiting.",
  },
];

function AboutPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="About"
          title="A small team is not a limitation. It is who does the work."
          lead="Tharigopula Technologies is a lean, founder-led technology practice based in Hyderabad. When you hire us, you get the person who understands your business doing the build — not a proposal written by one team and delivered by another."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            [
              "Business first",
              "We spend the first conversation on your workflow, not our stack. The right build is the one that removes real friction.",
            ],
            [
              "Built to be used",
              "Software only pays off when your team adopts it. Clear screens, sensible defaults, minimal training.",
            ],
            [
              "Long-term thinking",
              "Systems are designed to grow — new modules, new data, new automation — without a rebuild.",
            ],
          ].map(([t, b]) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">{t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Working together"
          title="The questions people actually ask before hiring us"
          lead="Answered plainly, because the alternative is you having to ask."
        />
        <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
          {ENGAGEMENT.map((item) => (
            <div key={item.q} className="bg-card p-6">
              <dt className="font-display text-lg font-semibold">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeading
              eyebrow="Where we are"
              title="Hyderabad, working with businesses anywhere in India"
            />
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Most of what we build is delivered remotely, which keeps costs down and means location
              is rarely a constraint. For projects that genuinely need someone on site — mapping a
              factory workflow, training a front desk — we travel.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              We are deliberately transparent about scale. Tharigopula Technologies is not a large
              agency, and does not price like one. That is the point.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Talk to us directly
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <a
                href={`mailto:${site.email}`}
                onClick={() => track({ name: "email_clicked", source: "about" })}
                className="text-sm hover:underline"
              >
                {site.email}
              </a>
              <a
                href={`tel:+${site.whatsapp}`}
                onClick={() => track({ name: "phone_clicked", source: "about" })}
                className="text-sm hover:underline"
              >
                {site.phoneDisplay}
              </a>
              <a
                href={whatsappLink(
                  "Hello Tharigopula Technologies, I would like to discuss a project.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track({ name: "whatsapp_clicked", source: "about" })}
                className="mt-2 inline-block w-fit rounded-md border border-border px-4 py-2.5 text-sm font-semibold"
              >
                Message on WhatsApp
              </a>
            </div>
            <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
              Not ready to talk? The{" "}
              <Link to="/start-project" className="font-medium text-foreground hover:text-signal">
                configurator
              </Link>{" "}
              gives you an indicative range without contacting anyone.
            </p>
          </div>
        </div>
      </Section>

      <Section className="bg-secondary/40">
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
