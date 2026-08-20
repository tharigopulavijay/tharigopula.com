import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/site/primitives";
import { DemoPageHeader } from "@/components/site/DemoPageHeader";
import { Laptop } from "@/components/site/DeviceFrames";
import { DashboardScreen } from "@/components/site/DemoScreens";
import { CTABanner } from "@/components/site/CTABanner";
import { businesses } from "@/data/demo-platform";
import { systemById, inr } from "@/data/catalog";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/live-demos/business-software")({
  head: () => ({
    meta: [
      {
        title: "Business Software Demos — CRM, Operations & Dashboards | Tharigopula Technologies",
      },
      {
        name: "description",
        content:
          "Open a working operations system with real records — leads, orders, inventory, billing, service and reporting, configured for six different kinds of business.",
      },
      { property: "og:title", content: "Business Software Demos | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "A running CRM and operations system you can click through, not a screenshot.",
      },
    ],
  }),
  component: BusinessSoftwareDemosPage,
});

const MODULES: { title: string; body: string; cue: string }[] = [
  {
    title: "Lead management & CRM",
    body: "Every enquiry visible with a stage and an owner. Drag a card and the pipeline moves.",
    cue: "Pipeline",
  },
  {
    title: "Operations & ERP workflows",
    body: "Orders, procurement and jobs moving through the same board your team already thinks in.",
    cue: "Orders",
  },
  {
    title: "Inventory & billing",
    body: "Live stock with reorder alerts, and one ledger for what was sold versus what was collected.",
    cue: "Stock",
  },
  {
    title: "Management dashboards",
    body: "The numbers that decide things, on today's data rather than at month-end.",
    cue: "Reports",
  },
];

function BusinessSoftwareDemosPage() {
  return (
    <>
      <DemoPageHeader
        crumb="Business Software Demos"
        title="Business software demos"
        accentTitle="that run real operations."
        lead="Explore a working system that handles complex operations simply — from leads to orders, inventory, billing, service and reporting. Six businesses, each with its own real records."
        primary={{ to: "/demo/platform", label: "Open the live demo" }}
        secondary={{ to: "/contact", label: "Request custom demo" }}
        assurances={["No login required", "Real records to click", "Six business types"]}
        visualWide
        visual={<LaptopVisual />}
      />

      {/* Which business to open it as */}
      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            Open it as your kind of business
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            The same system, loaded with the records, products and workflows that sector actually
            runs on.
          </p>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link
              key={b.slug}
              to="/demo/platform"
              search={{ industry: b.slug }}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
                {b.slug.replace(/-/g, " ")}
              </p>
              <h3 className="mt-2 font-display text-base font-semibold">{b.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.tagline}</p>
              <span className="mt-auto pt-4 text-[13px] font-medium text-signal">
                Open this demo{" "}
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

      {/* What's inside */}
      <Section className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((m) => (
            <div key={m.title} className="rounded-2xl border border-border bg-card p-5">
              <span className="inline-block rounded-full border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                {m.cue}
              </span>
              <h3 className="mt-3 font-display text-base leading-snug font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          A CRM or operations system starts at{" "}
          <strong className="text-foreground">{inr(systemById("crm").low)}</strong>; a smaller
          internal tool from{" "}
          <strong className="text-foreground">{inr(systemById("software").low)}</strong>.
        </p>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="See how this would run your business"
          body="Tell us how work moves through your company today and we'll show you the version of this built around it."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like a business software demo for my company.",
          )}
        />
      </Section>
    </>
  );
}

/** The dashboard in a laptop, reusing the composition from the gateway hero. */
function LaptopVisual() {
  return (
    <div className="flex justify-center">
      <Laptop scale={0.5} className="sm:hidden">
        <DashboardScreen />
      </Laptop>
      <Laptop scale={0.78} className="hidden sm:block">
        <DashboardScreen />
      </Laptop>
    </div>
  );
}
