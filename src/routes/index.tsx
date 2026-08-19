import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { SystemFlow } from "@/components/site/SystemFlow";
import { FeatureGrid, ProjectCard } from "@/components/site/cards";
import { CardGrid, Icons, type GridItem } from "@/components/site/HomeGrids";
import {
  PreviewPlatform,
  PreviewPricing,
  PreviewSolutions,
  PreviewStudio,
  PreviewWork,
} from "@/components/site/PagePreview";
import { CTASection } from "@/components/site/CTASection";
import { EstimatorTeaser } from "@/components/site/EstimatorTeaser";
import { whyPoints } from "@/data/solutions";
import { industries } from "@/data/industries";
import { caseStudies } from "@/data/portfolio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tharigopula Technologies — Technology built around your business" },
      {
        name: "description",
        content:
          "Websites, business software, automation, dashboards and AI. We understand how your business works first, then build the system it actually needs.",
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

/**
 * Facts a visitor can verify, not claims they have to take on trust.
 * Deliberately no client counts or years-in-business — an early practice that
 * quotes numbers invites the reader to weigh them, and silence reads stronger
 * than a small figure.
 */
const HERO_MARKERS = [
  { label: "Business-first approach", icon: <MarkerTarget /> },
  { label: "Custom & scalable", icon: <MarkerBlocks /> },
  { label: "Built in Hyderabad, India", icon: <MarkerPin /> },
];

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/60 to-background">
      <Container className="relative py-14 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="reveal">
            <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Technology built
              <br />
              around <span className="text-signal">your business.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tharigopula builds websites, business software, automation, dashboards and AI around
              how your business actually works — starting with one problem, not a platform.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/experience-lab"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
              >
                See live demos <span aria-hidden>→</span>
              </Link>
              <Link
                to="/start-project"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
              >
                Get project estimate
              </Link>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
              {HERO_MARKERS.map((m) => (
                <li key={m.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-signal" aria-hidden>
                    {m.icon}
                  </span>
                  {m.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal" style={{ animationDelay: "120ms" }}>
            <SystemFlow />
          </div>
        </div>
      </Container>
    </section>
  );
}

function markerSvg(children: React.ReactNode) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
function MarkerTarget() {
  return markerSvg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>,
  );
}
function MarkerBlocks() {
  return markerSvg(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 6.5h7M6.5 14v7" />
    </>,
  );
}
function MarkerPin() {
  return markerSvg(
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>,
  );
}

/** Section heading, centred — the rhythm the grids below sit under. */
function Band({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 text-sm text-muted-foreground sm:text-base">{lead}</p> : null}
    </div>
  );
}

/**
 * Entry by problem rather than by product name. A business owner does not wake
 * up wanting "a CRM" — they wake up unable to find who called last week.
 */
const IMPROVE: GridItem[] = [
  {
    title: "Get more customers",
    body: "Websites, landing pages and enquiry capture.",
    icon: <Icons.customers />,
    to: "/solutions",
  },
  {
    title: "Run operations better",
    body: "CRM, inventory, billing and service in one place.",
    icon: <Icons.operations />,
    to: "/demo/platform",
  },
  {
    title: "Automate repetitive work",
    body: "Reminders, approvals and follow-ups that run themselves.",
    icon: <Icons.automate />,
    to: "/demo/platform",
  },
  {
    title: "Build a custom system",
    body: "Software shaped to your workflow, not the other way round.",
    icon: <Icons.custom />,
    to: "/solutions",
  },
  {
    title: "Improve reporting",
    body: "Live numbers without waiting for month-end.",
    icon: <Icons.reporting />,
    to: "/solutions",
  },
  {
    title: "Launch an app",
    body: "Customer portals and mobile apps.",
    icon: <Icons.app />,
    to: "/solutions",
  },
];

const INDUSTRY_CARDS: GridItem[] = [
  {
    title: "Manufacturing",
    body: "Orders, stock, dispatch and warranty.",
    icon: <Icons.factory />,
    to: "/industries/$slug",
    params: { slug: "manufacturing" },
  },
  {
    title: "Healthcare",
    body: "Appointments, records and reminders.",
    icon: <Icons.clinic />,
    to: "/industries/$slug",
    params: { slug: "healthcare" },
  },
  {
    title: "Restaurants",
    body: "Bookings, menu and repeat guests.",
    icon: <Icons.restaurant />,
    to: "/industries/$slug",
    params: { slug: "restaurants" },
  },
  {
    title: "Retail",
    body: "Billing, stock and customer history.",
    icon: <Icons.retail />,
    to: "/industries/$slug",
    params: { slug: "retail" },
  },
  {
    title: "Real Estate",
    body: "Enquiries, site visits and collections.",
    icon: <Icons.realEstate />,
    to: "/industries/$slug",
    params: { slug: "real-estate" },
  },
  {
    title: "Professional Services",
    body: "Engagements, documents and deadlines.",
    icon: <Icons.professional />,
    to: "/industries/$slug",
    params: { slug: "professional-services" },
  },
];

const EXPLORE = [
  {
    title: "Solutions",
    body: "The full range, grouped by what it does.",
    to: "/solutions",
    cta: "Explore solutions",
    preview: <PreviewSolutions />,
  },
  {
    title: "Live business platform",
    body: "Open a working system for your industry.",
    to: "/demo/platform",
    cta: "Open the demo",
    preview: <PreviewPlatform />,
  },
  {
    title: "Website Studio",
    body: "Compare five website experience levels.",
    to: "/website-studio",
    cta: "Visit the studio",
    preview: <PreviewStudio />,
  },
  {
    title: "Work",
    body: "How we would build it, worked through.",
    to: "/portfolio",
    cta: "View the work",
    preview: <PreviewWork />,
  },
  {
    title: "Pricing & estimate",
    body: "Indicative ranges and a configurator.",
    to: "/pricing",
    cta: "See pricing",
    preview: <PreviewPricing />,
  },
];

function Home() {
  return (
    <>
      <Hero />

      <Section>
        <Band
          title="What do you want to improve?"
          lead="Most businesses do not start with a technology name. They start with something that is not working."
        />
        <CardGrid items={IMPROVE} cols={6} />
      </Section>

      <Section className="bg-secondary/40">
        <Band
          title="Explore what we do"
          lead="Jump to the area you need. Each one has a dedicated page with the detail."
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {EXPLORE.map((e) => (
            <Link
              key={e.title}
              to={e.to}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-lift"
            >
              <div className="h-[104px] border-b border-border bg-secondary/50 p-2.5">
                {e.preview}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-[15px] font-semibold">{e.title}</h3>
                <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{e.body}</p>
                <span className="mt-auto pt-3 text-[13px] font-medium text-signal">
                  {e.cta}{" "}
                  <span
                    aria-hidden
                    className="inline-block transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <Band
          title="Industries we serve"
          lead="Each industry has its own version of the same problems. Start with yours."
        />
        <CardGrid items={INDUSTRY_CARDS} cols={6} />
        <p className="mt-8 text-center">
          <Link
            to="/industries"
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-signal"
          >
            See all {industries.length} industries <span aria-hidden>→</span>
          </Link>
        </p>
      </Section>

      <Section className="bg-secondary/40">
        <Band
          title="Recent work"
          lead="Each one says plainly whether it is a delivered client system or a solution designed to show the approach."
        />
        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.slice(0, 3).map((c) => (
            <ProjectCard key={c.slug} study={c} />
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-signal"
          >
            View more work <span aria-hidden>→</span>
          </Link>
        </p>
      </Section>

      <Section>
        <Band
          title="Why businesses choose Tharigopula"
          lead="No claims we cannot back. These are things you can hold us to."
        />
        <div className="mt-9">
          <FeatureGrid items={whyPoints.slice(0, 6)} />
        </div>
      </Section>

      <Section className="bg-secondary/40" id="estimator">
        <Band
          title="Find out roughly what it costs"
          lead="Before you talk to anyone. The configurator gives a range and writes out what is included."
        />
        <div className="mt-9">
          <EstimatorTeaser />
        </div>
      </Section>

      <CTASection />
    </>
  );
}
