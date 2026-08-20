import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { HeroShowcase } from "@/components/site/HeroShowcase";
import { PillarCard } from "@/components/site/PillarCard";
import { CTABanner } from "@/components/site/CTABanner";
import { pillars } from "@/data/pillars";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/solutions")({
  head: () => ({
    meta: [
      { title: "Solutions — Websites, Software, Automation, Data & AI | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "From websites to business systems, automation, dashboards and AI — technology built to fit the way your business already works.",
      },
      { property: "og:title", content: "Solutions | Tharigopula Technologies" },
      {
        property: "og:description",
        content:
          "Websites, CRM and operations systems, automation, dashboards and AI for growing businesses.",
      },
    ],
  }),
  component: SolutionsPage,
});

const MARKERS = ["Business-first approach", "Custom & scalable", "Built in Hyderabad, India"];

function Tick() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SolutionsPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <Container className="relative py-10 sm:py-14 lg:py-16">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <span aria-hidden className="px-2">
              ›
            </span>
            <span className="text-signal">Solutions</span>
          </nav>

          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div className="reveal">
              <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.35rem]">
                Solutions built
                <br />
                around <span className="text-signal">your business.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                From websites to business systems, automation, dashboards and AI — we build
                technology that fits the way you work and helps you grow.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#core-solutions"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
                >
                  Explore solutions <span aria-hidden>→</span>
                </a>
                <Link
                  to="/experience-lab"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                  </svg>
                  See live demos
                </Link>
              </div>

              <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
                {MARKERS.map((m) => (
                  <li key={m} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      aria-hidden
                      className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-signal"
                    >
                      <Tick />
                    </span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <HeroShowcase />
            </div>
          </div>
        </Container>
      </section>

      <Section id="core-solutions">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
            Our core solutions
          </p>
          <h2 className="mt-3 font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            End-to-end technology for every stage of your business
          </h2>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((p) => (
            <PillarCard key={p.id} pillar={p} />
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Ready to build the right solution for your business?"
          body="Let us discuss your goals and create something that actually fits."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like to discuss a solution for my business.",
          )}
        />
      </Section>
    </>
  );
}
