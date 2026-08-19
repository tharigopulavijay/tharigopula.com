import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { HeroShowcase } from "@/components/site/HeroShowcase";
import { CardGrid, Icons, type GridItem } from "@/components/site/HomeGrids";
import { CTABanner } from "@/components/site/CTABanner";
import { industries } from "@/data/industries";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tharigopula Technologies — Technology built around your business" },
      {
        name: "description",
        content:
          "We build websites, business software, automation, dashboards, apps and AI around real business workflows — helping companies attract customers, streamline operations and grow.",
      },
      {
        property: "og:title",
        content: "Tharigopula Technologies — Technology built around your business",
      },
      {
        property: "og:description",
        content:
          "Websites. Software. Data. Automation. AI. One technology partner for growing businesses.",
      },
    ],
  }),
  component: Home,
});

/** Centred section heading — the rhythm every band below sits under. */
function Band({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-[2rem]">{title}</h2>
      {lead ? <p className="mt-3 text-sm text-muted-foreground sm:text-base">{lead}</p> : null}
    </div>
  );
}

/**
 * Four pillars rather than six capability groups. Someone deciding whether this
 * company is even relevant does not need the full taxonomy — that lives on
 * /solutions. Four is about the most anyone takes in at a glance.
 */
const PILLARS: (GridItem & { to: string })[] = [
  {
    title: "Websites & Digital Presence",
    body: "High-performing websites that build trust, generate leads and deliver results.",
    icon: <Icons.customers />,
    to: "/website-studio",
  },
  {
    title: "Business Software & Apps",
    body: "Custom software and mobile apps designed around your business processes.",
    icon: <Icons.custom />,
    to: "/solutions",
  },
  {
    title: "Automation & Integrations",
    body: "Automate workflows, connect tools and eliminate manual work to save time.",
    icon: <Icons.automate />,
    to: "/demo/platform",
  },
  {
    title: "Data, Dashboards & AI",
    body: "Real-time dashboards, reporting and AI insights to help you decide faster.",
    icon: <Icons.reporting />,
    to: "/solutions",
  },
];

/** Name only — the detail belongs on the industry page, not here. */
const INDUSTRY_CARDS: GridItem[] = [
  {
    title: "Manufacturing",
    body: "",
    icon: <Icons.factory />,
    to: "/industries/$slug",
    params: { slug: "manufacturing" },
  },
  {
    title: "Healthcare",
    body: "",
    icon: <Icons.clinic />,
    to: "/industries/$slug",
    params: { slug: "healthcare" },
  },
  {
    title: "Restaurants",
    body: "",
    icon: <Icons.restaurant />,
    to: "/industries/$slug",
    params: { slug: "restaurants" },
  },
  {
    title: "Retail",
    body: "",
    icon: <Icons.retail />,
    to: "/industries/$slug",
    params: { slug: "retail" },
  },
  {
    title: "Real Estate",
    body: "",
    icon: <Icons.realEstate />,
    to: "/industries/$slug",
    params: { slug: "real-estate" },
  },
  {
    title: "Professional Services",
    body: "",
    icon: <Icons.professional />,
    to: "/industries/$slug",
    params: { slug: "professional-services" },
  },
];

/** Promises that can be held to, with no numbers behind them. */
const WHY = [
  {
    title: "Start with the business",
    body: "We understand your goals first, then design the right solution.",
    icon: <Icons.customers />,
  },
  {
    title: "Built around your workflow",
    body: "Solutions aligned to your processes, not the other way around.",
    icon: <Icons.custom />,
  },
  {
    title: "Start small, expand later",
    body: "Launch fast, prove value, and scale as the business grows.",
    icon: <Icons.reporting />,
  },
  {
    title: "Clear scope and pricing",
    body: "Transparent communication, timelines and pricing — no hidden surprises.",
    icon: <Icons.operations />,
  },
];

const HERO_MARKERS = ["Business-first approach", "Custom & scalable", "Built in Hyderabad, India"];

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

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
      <Container className="relative py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div className="reveal">
            <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
              Business-first. Technology driven.
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.35rem]">
              Technology built
              <br />
              <span className="text-signal">around your business.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              We build websites, business software, automation, dashboards, apps and AI around real
              business workflows — helping companies attract customers, streamline operations and
              grow.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/solutions"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
              >
                Explore solutions <span aria-hidden>→</span>
              </Link>
              <Link
                to="/start-project"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
              >
                Get project estimate <span aria-hidden>→</span>
              </Link>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
              {HERO_MARKERS.map((m) => (
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
  );
}

function Home() {
  return (
    <>
      <Hero />

      <Section>
        <Band title="What we do" />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PILLARS.map((p) => (
            <Link
              key={p.title}
              to={p.to}
              className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-lift"
            >
              <span
                aria-hidden
                className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-signal transition-colors group-hover:bg-signal group-hover:text-signal-foreground"
              >
                {p.icon}
              </span>
              <h3 className="mt-4 font-display text-base leading-snug font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-snug text-muted-foreground">{p.body}</p>
              <span className="mt-auto pt-4 text-sm font-medium text-signal">
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
      </Section>

      <Section className="bg-secondary/40">
        <Band title="Solutions tailored for your industry" />
        <CardGrid items={INDUSTRY_CARDS} cols={6} />
        <p className="mt-8 text-center">
          <Link
            to="/industries"
            className="inline-flex items-center gap-2 text-sm font-medium text-signal hover:underline"
          >
            View all {industries.length} industries <span aria-hidden>→</span>
          </Link>
        </p>
      </Section>

      {/* One strip of proof. The page is otherwise all promise, and being able to
          operate the demos is the strongest thing this business has to show. */}
      <Section>
        <Band
          title="See it working before you commit"
          lead="Open a business system configured for your industry, or compare five levels of website side by side. Both are live on this site."
        />
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/demo/platform"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground"
          >
            Try the live business platform <span aria-hidden>→</span>
          </Link>
          <Link
            to="/experience-lab"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
          >
            Compare website experiences
          </Link>
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <Band title="Why businesses choose Tharigopula" />
        <div className="mt-9 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.title} className="flex gap-4">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-signal/10 text-signal"
              >
                {w.icon}
              </span>
              <div>
                <h3 className="font-display text-[15px] leading-snug font-semibold">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{w.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <CTABanner
          title="Ready to build what your business really needs?"
          body="Tell us your goals. We will take care of the technology."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like to discuss a project.",
          )}
        />
      </Section>
    </>
  );
}
