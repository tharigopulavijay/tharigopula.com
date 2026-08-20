import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/primitives";
import { DemoPageHeader } from "@/components/site/DemoPageHeader";
import { WorkflowRunner } from "@/components/site/WorkflowRunner";
import { CTABanner } from "@/components/site/CTABanner";
import { workflowSteps } from "@/data/demo-automation";
import { systemById, inr } from "@/data/catalog";
import { whatsappLink } from "@/data/site";

export const Route = createFileRoute("/live-demos/automation")({
  head: () => ({
    meta: [
      { title: "Automation Demos — Watch The Work Happen Itself | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Run a real workflow: a website enquiry becomes a CRM record, a notification, an assignment, an approval, an invoice and a dashboard update — without anyone typing.",
      },
      { property: "og:title", content: "Automation Demos | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Follow one enquiry from a website form to an updated dashboard, step by step.",
      },
    ],
  }),
  component: AutomationDemosPage,
});

const CAPABILITIES: { title: string; points: string[] }[] = [
  {
    title: "Lead automation",
    points: [
      "Capture from website, apps and campaigns",
      "Auto-assign by territory, product or load",
      "No re-typing between systems",
      "Follow-ups that fire on their own",
    ],
  },
  {
    title: "Notifications & integrations",
    points: [
      "Instant WhatsApp and email alerts",
      "Acknowledgement to the customer too",
      "Connects the tools you already pay for",
      "Nothing important waits for someone to notice",
    ],
  },
  {
    title: "Approval workflows",
    points: [
      "Multi-level sign-off on discounts and spend",
      "Rules by role, value or customer",
      "Status visible to everyone involved",
      "The trail is kept for you",
    ],
  },
  {
    title: "Reporting automation",
    points: [
      "Dashboards that update as work happens",
      "Scheduled reports to the people who need them",
      "No evening spreadsheet reconciliation",
      "Decisions on today's numbers, not last week's",
    ],
  },
];

function AutomationDemosPage() {
  return (
    <>
      <DemoPageHeader
        crumb="Automation Demos"
        title="Automation demos that show"
        accentTitle="work happening by itself."
        lead="See how we connect your tools, automate the repetitive steps and keep your business moving — saving time, cutting mistakes and letting people get on with the work that needs them."
        primary={{ to: "#run", label: "Run the workflow", hash: "#run" }}
        secondary={{ to: "/contact", label: "Request custom demo" }}
        assurances={["Real workflow", "Step at your own pace", "Works with tools you have"]}
        visualWide
        visual={<FlowPreview />}
      />

      <Section id="run">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            From lead to result — end to end
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            One enquiry, seven steps. Press run, or click any step to jump to it. Watch the record
            on the right fill itself in.
          </p>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div className="mt-10">
          <WorkflowRunner />
        </div>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-5"
            >
              <h3 className="font-display text-base leading-snug font-semibold">{c.title}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {c.points.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-sm leading-snug text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Workflow automation starts at{" "}
          <strong className="text-foreground">{inr(systemById("automation").low)}</strong>. Most
          businesses start with one workflow that hurts, then add more once they trust it.
        </p>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Want to see your own process automated?"
          body="Describe the steps your team repeats every day and we'll map the version that runs itself."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like to automate a process in my business.",
          )}
        />
      </Section>
    </>
  );
}

/**
 * A static read-only version of the flow for the header.
 *
 * The runnable one lives further down the page; putting the interactive
 * component in the header too would mean two competing controls and a reader
 * who has to work out which is the real one.
 */
function FlowPreview() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-center text-sm font-semibold">
        From lead to result — automated end to end
      </p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {workflowSteps.map((s, i) => (
          <li
            key={s.n}
            className="relative rounded-xl border border-border bg-secondary/40 p-3"
            style={{ opacity: 1 - i * 0.055 }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-signal text-[11px] font-bold text-signal-foreground">
              {s.n}
            </span>
            <p className="mt-2 text-[13px] leading-tight font-semibold">{s.title}</p>
            <p className="mt-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {s.where}
            </p>
          </li>
        ))}
        <li className="flex items-center justify-center rounded-xl border border-dashed border-border p-3">
          <span className="text-center text-[11px] leading-snug text-muted-foreground">
            …and it runs
            <br />
            every time
          </span>
        </li>
      </ol>
    </div>
  );
}
