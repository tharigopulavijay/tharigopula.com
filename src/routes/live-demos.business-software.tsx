import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/primitives";
import { DemoPageHeader } from "@/components/site/DemoPageHeader";
import { AppFrame } from "@/components/site/AppFrame";
import { Laptop } from "@/components/site/DeviceFrames";
import { DashboardScreen } from "@/components/site/DemoScreens";
import { CTABanner } from "@/components/site/CTABanner";
import { systemById, inr } from "@/data/catalog";
import { whatsappLink } from "@/data/site";

/** The demo is a self-contained app served from public/, not a router route. */
const DEMO_SRC = "/demos/business-os.html";

export const Route = createFileRoute("/live-demos/business-software")({
  head: () => ({
    meta: [
      {
        title:
          "Business Software Demo — A Working CRM & Operations System | Tharigopula Technologies",
      },
      {
        name: "description",
        content:
          "Open a complete business operating system and click through it — leads, customers, sales, purchases, inventory, service, warranty and dashboards, with real records and five staff roles.",
      },
      { property: "og:title", content: "Business Software Demo | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "A full CRM and operations system you can actually use, not a screenshot.",
      },
    ],
  }),
  component: BusinessSoftwareDemoPage,
});

/**
 * The ten modules the demo ships with, described by what they take off
 * somebody's desk rather than by what they contain.
 */
const MODULES: { cue: string; title: string; body: string }[] = [
  {
    cue: "Dashboard",
    title: "One screen that answers “how are we doing”",
    body: "Revenue, receivables, pipeline value, stock warnings and jobs needing attention — on today's numbers, not last month's.",
  },
  {
    cue: "Action Center",
    title: "The day's work, already prioritised",
    body: "Every overdue job, follow-up and reorder becomes a task with an owner and a due date. Nothing lives in someone's head.",
  },
  {
    cue: "Leads",
    title: "Pipeline with a stage and an owner",
    body: "Enquiries tracked from first contact through quotation and negotiation to won, with the follow-up dates that keep them moving.",
  },
  {
    cue: "Customers",
    title: "A whole account on one page",
    body: "Purchase history, the equipment they own, warranty position, service record and every conversation.",
  },
  {
    cue: "Sales",
    title: "Invoices, repeat sales and warranty",
    body: "What was sold, what has been collected, what is still outstanding, and who is due to buy again.",
  },
  {
    cue: "Stores",
    title: "Stock that reconciles itself",
    body: "Raise an invoice and finished-goods stock moves with it. Materials below their reorder point raise themselves as tasks.",
  },
  {
    cue: "Purchases",
    title: "Suppliers, RFQs and purchase orders",
    body: "Request quotations, compare them, and keep every purchase tied to the material it replenished.",
  },
  {
    cue: "Products & BOM",
    title: "What each product is actually made of",
    body: "Bills of material tying finished goods to the materials and quantities they consume.",
  },
  {
    cue: "Service",
    title: "Job cards, schedules and calibration",
    body: "Scheduled visits, breakdown jobs, calibration certificates, and whether the work is in warranty or chargeable.",
  },
  {
    cue: "Engagement",
    title: "Staying in front of customers",
    body: "Warranty-expiry reminders, service follow-ups and product updates — tracked rather than remembered.",
  },
];

function BusinessSoftwareDemoPage() {
  return (
    <>
      <DemoPageHeader
        crumb="Business Software Demo"
        title="A complete business system"
        accentTitle="you can actually click through."
        lead="Leads, customers, sales, purchases, stock, service and dashboards — one connected system with real records in it. Open it and use it; nothing here is a screenshot."
        primary={{ to: "#demo", label: "Open the demo", hash: "#demo" }}
        secondary={{ to: "/contact", label: "Request custom demo" }}
        assurances={["No login required", "Real records to click", "Five staff roles"]}
        visualWide
        visual={
          <div className="flex justify-center">
            <Laptop scale={0.5} className="sm:hidden">
              <DashboardScreen />
            </Laptop>
            <Laptop scale={0.78} className="hidden sm:block">
              <DashboardScreen />
            </Laptop>
          </div>
        }
      />

      <Section id="demo">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            The system, running
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Change the role in the top right to see the same system as an owner, a salesperson, a
            service engineer or the stores team — each one sees only their own work.
          </p>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10">
          <AppFrame
            src={DEMO_SRC}
            title="Business OS — live demo"
            label="Business OS — demo data, and anything you change stays in your browser"
          />
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Built for a desktop, the way the people who live in it all day would use it —{" "}
          <a
            href={DEMO_SRC}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-signal hover:underline"
          >
            open it full screen
          </a>{" "}
          for the real thing.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            What's inside it
          </h2>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.cue} className="rounded-2xl border border-border bg-card p-5">
              <span className="inline-block rounded-full border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                {m.cue}
              </span>
              <h3 className="mt-3 font-display text-base leading-snug font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Framing this as one example rather than a product keeps the promise
          honest: what gets built for a visitor will not look like this. */}
      <Section className="pt-0">
        <div className="rounded-2xl border border-border bg-secondary/50 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">
            This is one example, not a template
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            The system above was built around one manufacturer's way of working — its products, its
            service cycles, its stock. That is the whole point. A generic CRM makes you change how
            you work to suit the software; we do the opposite, so what we build for you carries your
            modules, your stages and your terminology rather than these.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            A system at this depth starts at{" "}
            <strong className="text-foreground">{inr(systemById("crm").low)}</strong>; a smaller
            internal tool covering one or two of these areas from{" "}
            <strong className="text-foreground">{inr(systemById("software").low)}</strong>.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="See this built around your business"
          body="Tell us how work moves through your company today — enquiry to delivery to payment — and we'll show you the version of this shaped around it."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like a business software demo for my company.",
          )}
        />
      </Section>
    </>
  );
}
