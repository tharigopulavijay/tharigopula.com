import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section } from "@/components/site/primitives";
import { TierPreview } from "@/components/site/TierPreview";
import { CTABanner } from "@/components/site/CTABanner";
import { experienceLevels } from "@/data/experience-lab";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/live-demos/websites")({
  head: () => ({
    meta: [
      { title: "Website Demos — Every Experience Level, Live | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "From a clean brochure site to a 3D interactive experience — see what Essential, Dynamic, Interactive, Cinematic and 3D actually look like, with a working demo behind each.",
      },
      { property: "og:title", content: "Website Demos | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Five website experience levels, each with a live demo you can scroll.",
      },
    ],
  }),
  component: WebsiteDemosPage,
});

/** Maps the data's slugs onto the preview component's levels. */
const LEVEL_OF: Record<string, "essential" | "dynamic" | "interactive" | "cinematic" | "3d"> = {
  essential: "essential",
  dynamic: "dynamic",
  interactive: "interactive",
  cinematic: "cinematic",
  "3d": "3d",
};

const ASSURANCES = [
  { title: "Built for performance", body: "Fast, secure and optimised on every device." },
  { title: "SEO & speed ready", body: "Structured to rank and built to load quickly." },
  { title: "Mobile-first", body: "Designed for the phone your customers actually use." },
  { title: "Scalable", body: "Room to grow into the next tier without starting over." },
];

function WebsiteDemosPage() {
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
            <Link to="/live-demos" className="hover:text-foreground">
              Live Demos
            </Link>
            <span aria-hidden className="px-2">
              ›
            </span>
            <span className="text-signal">Website Demos</span>
          </nav>

          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl">
              Website demos that show
              <br />
              every <span className="text-signal">experience level</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              From clean and simple to immersive and interactive — the same fictional business,
              built five separate ways, with a working demo behind every one.
            </p>
          </div>
        </Container>
      </section>

      <Section>
        {/* Five across only at 2xl. Below that the feature lists become unreadable
            columns, so the grid steps down rather than shrinking the type. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {experienceLevels.map((l) => (
            <article
              key={l.slug}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
                  {l.index}
                </span>
                <h2 className="font-display text-lg font-semibold">{l.name}</h2>
              </div>

              <div className="mt-4 mb-5">
                <TierPreview level={LEVEL_OF[l.slug]!} />
              </div>

              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.oneLiner}</p>

              <ul className="mt-4 flex flex-col gap-1.5">
                {l.includes.slice(0, 5).map((inc) => (
                  <li key={inc} className="flex items-start gap-2 text-[13px] leading-snug">
                    <span aria-hidden className="mt-1 shrink-0 text-signal">
                      <svg
                        width="12"
                        height="12"
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
                    <span className="text-muted-foreground">{inc}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto border-t border-border pt-4 text-center">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Indicative
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-signal">{l.price}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{l.timeline}</p>

                <a
                  href={l.demoPath}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                  </svg>
                  Open live demo
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* The side-by-side comparison is a different job from browsing the tiers,
            and it already exists — so this points at it instead of rebuilding it. */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Want them side by side with a feature-by-feature comparison?{" "}
          <Link to="/experience-lab" className="font-medium text-signal hover:underline">
            Open the Experience Lab
          </Link>
          .
        </p>
      </Section>

      <Section className="pt-0">
        <div className="rounded-2xl border border-border bg-secondary/50 px-2 py-5">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ASSURANCES.map((a, idx) => (
              <li
                key={a.title}
                className={
                  idx > 0
                    ? "flex items-start gap-3 px-5 lg:border-l lg:border-border"
                    : "flex items-start gap-3 px-5"
                }
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-signal"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="text-sm leading-snug">
                  <span className="block font-semibold">{a.title}</span>
                  <span className="text-muted-foreground">{a.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Not sure which level fits?"
          body="Answer a few questions about what the site has to do and we'll tell you which tier is right — including when the cheaper one is the correct answer."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like help choosing a website experience level.",
          )}
        />
      </Section>
    </>
  );
}
