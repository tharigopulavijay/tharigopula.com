import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/primitives";
import { DemoPageHeader } from "@/components/site/DemoPageHeader";
import { DashboardDemo } from "@/components/site/DashboardDemo";
import { CTABanner } from "@/components/site/CTABanner";
import { systemById, inr } from "@/data/catalog";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/showcase/dashboards")({
  head: () => ({
    meta: [
      { title: "Dashboard Demos — Ask Your Numbers A Question | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "A working dashboard on twelve months of data. Change the period, branch or product group and every figure recomputes — revenue, margin, orders and the comparison against the previous period.",
      },
      { property: "og:title", content: "Dashboard Demos | Tharigopula Technologies" },
      {
        property: "og:description",
        content:
          "Filter it, drill into it, and watch every number move. Not a screenshot of a chart.",
      },
    ],
  }),
  component: DashboardDemosPage,
});

const WHAT_YOU_GET: { title: string; body: string }[] = [
  {
    title: "Your numbers, not a template's",
    body: "Built on whatever you already run on — Tally, spreadsheets, a billing system, a database. We read from where the data lives rather than asking you to re-enter it.",
  },
  {
    title: "Questions, not reports",
    body: "A monthly PDF answers one question. A dashboard answers the next twenty, including the ones you did not know you had until you saw the first answer.",
  },
  {
    title: "Current, not month-end",
    body: "Figures refresh as the work happens, so a decision on Tuesday uses Tuesday's position instead of last month's closing.",
  },
  {
    title: "Readable by everyone",
    body: "The person who needs it most is usually not the person who likes spreadsheets. Built so it can be read at a glance, on a phone if needed.",
  },
];

function DashboardDemosPage() {
  return (
    <>
      <DemoPageHeader
        crumb="Dashboard Demos"
        title="Dashboards that let you"
        accentTitle="ask your numbers a question."
        lead="This one runs on twelve months of sales across four branches and five product groups. Change the period, pick a branch, click a product group — every figure on the page recomputes, including the comparison against the previous period."
        primary={{ to: "#demo", label: "Try the dashboard", hash: "#demo" }}
        secondary={{ to: "/contact", label: "Request custom demo" }}
        assurances={["Live filtering", "12 months of data", "Nothing pre-baked"]}
        visualWide
        visual={<DashboardDemo />}
      />

      <Section id="demo" className="pt-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            What a dashboard is actually for
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Most businesses already have the data. What they do not have is a way to ask it anything
            without waiting three days for someone to build a spreadsheet.
          </p>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {WHAT_YOU_GET.map((w) => (
            <div key={w.title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display text-base leading-snug font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Dashboards and reporting start at{" "}
          <strong className="text-foreground">{inr(systemById("dashboard").low)}</strong> — the
          least expensive way to find out whether better visibility actually changes your decisions.
        </p>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Point this at your own numbers"
          body="Tell us where your data lives today and what you wish you could see. We'll show you the dashboard built on it."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like a dashboard for my business.",
          )}
        />
      </Section>
    </>
  );
}
