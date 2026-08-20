import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { LiveDemoHero } from "@/components/site/LiveDemoHero";
import { CTABanner } from "@/components/site/CTABanner";
import { demoAssurances, demoCategories } from "@/data/live-demos";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/live-demos/")({
  head: () => ({
    meta: [
      { title: "Live Demos — See What We Actually Build | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Explore working demos of mobile apps, websites, business software and automation. No login, no sales call — open them and see what your business could run on.",
      },
      { property: "og:title", content: "Live Demos | Tharigopula Technologies" },
      {
        property: "og:description",
        content:
          "Mobile apps, websites, business software and automation — real demos you can open right now.",
      },
    ],
  }),
  component: LiveDemosPage,
});

function LiveDemosPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
        <Container className="relative py-10 sm:py-12 lg:py-14">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <span aria-hidden className="px-2">
              ›
            </span>
            <span className="text-signal">Live Demos</span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div className="reveal">
              <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.35rem]">
                Live demos that show
                <br />
                what we <span className="text-signal">actually build</span>.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Explore real demos of mobile apps, websites, business software and automation —
                built around how businesses actually work, not around what sounds impressive.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#categories"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
                >
                  Explore demos <span aria-hidden>→</span>
                </a>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                  </svg>
                  Request a custom demo
                </Link>
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5">
                {demoAssurances.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckMark />
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <LiveDemoHero />
            </div>
          </div>
        </Container>
      </section>

      {/* Categories */}
      <Section id="categories">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            Explore demo categories
          </h2>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {demoCategories.map((c) => (
            <Link
              key={c.slug}
              to={c.to}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${c.accent} 14%, transparent)`,
                  color: `color-mix(in oklab, ${c.accent}, var(--accent-toward) var(--accent-lift))`,
                }}
                aria-hidden
              >
                <CategoryIcon slug={c.slug} />
              </span>

              <h3 className="mt-4 font-display text-base leading-snug font-semibold">{c.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.blurb}</p>

              <ul className="mt-4 flex flex-wrap gap-1.5">
                {c.previews.map((p) => (
                  <li
                    key={p}
                    className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {p}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between pt-5">
                <span
                  className="text-[13px] font-medium"
                  style={{
                    color: `color-mix(in oklab, ${c.accent}, var(--accent-toward) var(--accent-lift))`,
                  }}
                >
                  {c.cta}{" "}
                  <span
                    aria-hidden
                    className="inline-block transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {c.startingFrom}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Supporting summary. Deliberately light — it reinforces the four cards
          above rather than adding a fifth idea. */}
      <Section className="pt-0">
        <div className="rounded-2xl border border-border bg-secondary/50 px-2 py-5">
          <p className="text-center text-sm font-semibold">What you can preview</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Mobile apps on phone & tablet", "mobile-apps"],
              ["Website experience levels", "websites"],
              ["CRM & operations systems", "business-software"],
              ["Automation workflows", "automation"],
            ].map(([label, slug], idx) => (
              <li
                key={label}
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
                  <CategoryIcon slug={slug as never} />
                </span>
                <span className="text-sm leading-tight">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Need a demo tailored to your business?"
          body="Tell us your goals and we'll show you the right solution in action — built around your workflow, not a generic template."
          primary={{ to: "/contact", label: "Request a demo" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like a demo tailored to my business.",
          )}
        />
      </Section>
    </>
  );
}

function CheckMark() {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal/12 text-signal"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CategoryIcon({ slug }: { slug: (typeof demoCategories)[number]["slug"] }) {
  if (slug === "mobile-apps")
    return (
      <svg {...iconProps}>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </svg>
    );
  if (slug === "websites")
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 2.5 15 0 18-2.5-3-2.5-15.4 0-18Z" />
      </svg>
    );
  if (slug === "business-software")
    return (
      <svg {...iconProps}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </svg>
    );
  return (
    <svg {...iconProps}>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  );
}
