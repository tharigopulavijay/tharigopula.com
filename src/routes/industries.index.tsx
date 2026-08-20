import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { IndustryOrbit, ORBIT } from "@/components/site/IndustryOrbit";
import { CTABanner } from "@/components/site/CTABanner";
import { Icons } from "@/components/site/HomeGrids";
import { industries } from "@/data/industries";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/industries/")({
  head: () => ({
    meta: [
      {
        title:
          "Industry Solutions — Manufacturing, Healthcare, Retail & more | Tharigopula Technologies",
      },
      {
        name: "description",
        content:
          "Websites, software, automation, dashboards and AI built around how each industry actually works — manufacturing, healthcare, restaurants, retail, real estate and professional services.",
      },
      { property: "og:title", content: "Industry Solutions | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "The problems we usually find in your sector, and the systems that solve them.",
      },
    ],
  }),
  component: IndustriesPage,
});

/** One line each, written from the operator's side rather than ours. */
const SUMMARY: Record<string, string> = {
  manufacturing: "Streamline production, quality and supply chain operations.",
  healthcare: "Improve patient care, records and day-to-day clinic operations.",
  restaurants: "Enhance the customer experience and tighten daily operations.",
  retail: "Unify sales channels and deliver better customer experiences.",
  "real-estate": "Manage properties, leads and transactions efficiently.",
  "professional-services": "Deliver engagements, track time and grow client relationships.",
};

/**
 * What actually differs between industries.
 *
 * Worth stating plainly, because "we serve your industry" is the emptiest claim
 * on most agency sites. These are the three things that genuinely change.
 */
const ADAPT = [
  {
    title: "Business workflows",
    body: "We map how your business runs end to end before designing anything — enquiry to order to service.",
    icon: <Icons.custom />,
    tint: "#E8F0FE",
    color: "#2563EB",
  },
  {
    title: "Customer journeys",
    body: "We design around what your customers actually value at each step, not a generic funnel.",
    icon: <Icons.customers />,
    tint: "#E3F5ED",
    color: "#0EA36B",
  },
  {
    title: "Operational systems",
    body: "We build systems that integrate, automate and scale with you as the business grows.",
    icon: <Icons.operations />,
    tint: "#F0EAFC",
    color: "#7C4DDA",
  },
];

function IndustriesPage() {
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
            <span className="text-signal">Industries</span>
          </nav>

          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div className="reveal">
              <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.35rem]">
                Solutions tailored
                <br />
                for your <span className="text-signal">industry.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                We build websites, software, automation, dashboards and AI based on how each kind of
                business actually works — not a template with the industry name swapped in.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#industries"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
                >
                  Explore industries <span aria-hidden>→</span>
                </a>
                <Link
                  to="/start-project"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
                >
                  Get project estimate
                </Link>
              </div>
            </div>

            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <IndustryOrbit />
            </div>
          </div>
        </Container>
      </section>

      <Section id="industries">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            Industries we serve
          </h2>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ORBIT.map((i) => (
            <Link
              key={i.slug}
              to="/industries/$slug"
              params={{ slug: i.slug }}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-start gap-4">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                  style={{ background: i.tint, color: i.color }}
                  aria-hidden
                >
                  {i.icon}
                </span>
                <div>
                  <h3 className="font-display text-lg leading-snug font-semibold">{i.name}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                    {SUMMARY[i.slug]}
                  </p>
                </div>
              </div>
              <span className="mt-5 text-sm font-medium" style={{ color: i.color }}>
                Learn more{" "}
                <span
                  aria-hidden
                  className="inline-block transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          We work with {industries.length} industries in total —{" "}
          <Link to="/industries" hash="all" className="font-medium text-signal hover:underline">
            see the full list
          </Link>
          .
        </p>
      </Section>

      <Section className="bg-secondary/40">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            How we adapt by industry
          </h2>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {ADAPT.map((a) => (
            <div key={a.title} className="rounded-2xl border border-border bg-card p-6">
              <span
                className="grid h-12 w-12 place-items-center rounded-xl"
                style={{ background: a.tint, color: a.color }}
                aria-hidden
              >
                {a.icon}
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* The full thirteen, for anyone whose sector is not one of the six above. */}
      <Section id="all">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
            Every industry we work with
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Each has its own page with the problems we usually find and what it costs to fix them.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {industries.map((i) => (
            <Link
              key={i.slug}
              to="/industries/$slug"
              params={{ slug: i.slug }}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-signal hover:text-signal"
            >
              {i.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Need technology built around your business?"
          body="Let us build solutions that fit your industry and drive real results."
          primary={{ to: "/experience-lab", label: "View live demos" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like to discuss technology for my industry.",
          )}
        />
      </Section>
    </>
  );
}
