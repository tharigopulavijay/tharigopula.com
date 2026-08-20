import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { IndustrySkyline } from "@/components/site/IndustrySkyline";
import { ORBIT } from "@/components/site/IndustryOrbit";
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
          "Industry-focused websites, software, automation, dashboards and AI built to solve real challenges — manufacturing, healthcare, restaurants, retail, real estate and professional services.",
      },
      { property: "og:title", content: "Industry Solutions | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Every business is unique. Solutions built around how yours actually works.",
      },
    ],
  }),
  component: IndustriesPage,
});

/** Written from the operator's side — what changes for them, not what we supply. */
const SUMMARY: Record<string, string> = {
  manufacturing: "Streamline production, manage inventory and improve operational efficiency.",
  healthcare: "Improve patient care, manage operations and keep records in order.",
  restaurants: "Manage orders, kitchen, inventory and customer experience seamlessly.",
  retail: "Enhance sales, manage stock and deliver exceptional customer experiences.",
  "real-estate": "Manage properties, leads and deals with complete visibility and control.",
  "professional-services": "Manage projects, clients and teams to deliver more value every day.",
};

/**
 * The reassurance strip. These are commitments rather than statistics — an
 * early practice quoting client counts invites the reader to weigh them, and
 * every one of these can be held to on day one.
 */
const ASSURANCES = [
  { title: "Built for", strong: "every business", icon: <Icons.custom /> },
  { title: "Secure &", strong: "reliable", icon: <Icons.operations /> },
  { title: "Customisable", strong: "& scalable", icon: <Icons.reporting /> },
  { title: "Ongoing support", strong: "you can count on", icon: <Icons.customers /> },
];

function IndustriesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <Container className="relative py-10 sm:py-12 lg:py-14">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <span aria-hidden className="px-2">
              ›
            </span>
            <span className="text-signal">Industries</span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div className="reveal">
              <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.35rem]">
                Technology solutions
                <br />
                for <span className="text-signal">every industry</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Every business is unique. Our industry-focused solutions are built to solve real
                challenges and drive measurable growth.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#industries"
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
            </div>

            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <IndustrySkyline />
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

        {/* Six across only from xl — below that the descriptions become unreadable. */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ORBIT.map((i) => (
            <Link
              key={i.slug}
              to="/industries/$slug"
              params={{ slug: i.slug }}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span
                className="grid h-14 w-14 place-items-center rounded-full"
                style={{ background: i.tint, color: i.color }}
                aria-hidden
              >
                {i.icon}
              </span>
              <h3 className="mt-5 font-display text-[15px] leading-snug font-semibold">{i.name}</h3>
              <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
                {SUMMARY[i.slug]}
              </p>
              <span className="mt-auto pt-4 text-[13px] font-medium" style={{ color: i.color }}>
                View solutions{" "}
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

        {/* Assurance strip */}
        <div className="mt-6 rounded-2xl border border-border bg-secondary/50 px-2 py-5">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ASSURANCES.map((a, idx) => (
              <li
                key={a.title}
                className={
                  idx > 0
                    ? "flex items-center gap-3 px-5 lg:border-l lg:border-border"
                    : "flex items-center gap-3 px-5"
                }
              >
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card text-signal"
                >
                  {a.icon}
                </span>
                <span className="text-sm leading-tight">
                  {a.title}
                  <br />
                  <span className="font-semibold">{a.strong}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Answers the obvious objection for the seven sectors not shown above. */}
      <Section className="pt-0">
        <CTABanner
          title="Don't see your industry?"
          body={`We work with businesses of all types and sizes — ${industries.length} industries have their own page. Let us build something that fits yours.`}
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like to discuss technology for my business.",
          )}
        />
      </Section>

      {/* Every sector stays reachable, so nobody outside the six hits a dead end. */}
      <Section className="pt-0">
        <p className="text-center text-sm text-muted-foreground">
          All {industries.length} industries we work with:
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
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
    </>
  );
}
