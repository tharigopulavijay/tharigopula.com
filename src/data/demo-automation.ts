/**
 * The workflow the automation demo runs.
 *
 * One enquiry is followed all the way from a website form to an updated
 * dashboard. Each step carries the record's state *after* it runs, because the
 * thing worth showing is not that seven boxes exist — it is that the same
 * record gains an owner, a status and an invoice number without anyone typing.
 *
 * Fictional lead, illustrative timings.
 */

export type WorkflowStep = {
  n: number;
  title: string;
  /** What the automation does at this step, in the operator's words. */
  what: string;
  /** The tool or surface it happens in. */
  where: string;
  /** How long this step takes when a person does it by hand. */
  manual: string;
  /** Field values the record now carries. */
  sets: { field: string; value: string }[];
};

export const lead = {
  name: "Kavita Rao",
  company: "Rao Electricals",
  phone: "+91 98490 •••••",
  enquiry: "1.5T inverter split AC × 4 — office fit-out",
  source: "Website contact form",
};

export const workflowSteps: WorkflowStep[] = [
  {
    n: 1,
    title: "Lead captured",
    what: "Someone submits the enquiry form on your website.",
    where: "Website",
    manual: "—",
    sets: [
      { field: "Status", value: "New" },
      { field: "Source", value: "Website form" },
    ],
  },
  {
    n: 2,
    title: "Added to CRM",
    what: "A contact and a deal are created, with no re-typing and no lost enquiry.",
    where: "CRM",
    manual: "4 min",
    sets: [
      { field: "Record", value: "LEAD-2291" },
      { field: "Deal value", value: "₹1,70,000 (est.)" },
    ],
  },
  {
    n: 3,
    title: "Instant notification",
    what: "WhatsApp and email go out — to your team, and an acknowledgement to the customer.",
    where: "WhatsApp + Email",
    manual: "3 min",
    sets: [
      { field: "Customer notified", value: "Yes" },
      { field: "Team alerted", value: "Sales group" },
    ],
  },
  {
    n: 4,
    title: "Task assigned",
    what: "The lead is routed to the right person by territory, product or load.",
    where: "CRM",
    manual: "5 min",
    sets: [
      { field: "Owner", value: "Arjun Kumar" },
      { field: "Follow up by", value: "Today, 5:00 pm" },
    ],
  },
  {
    n: 5,
    title: "Approval flow",
    what: "The discount sits above the rep's limit, so it goes to a manager for sign-off.",
    where: "Approvals",
    manual: "1–2 days",
    sets: [
      { field: "Discount", value: "8% requested" },
      { field: "Approved by", value: "S. Reddy" },
    ],
  },
  {
    n: 6,
    title: "Invoice raised",
    what: "The quote becomes a confirmed order and an invoice, with the numbers already filled in.",
    where: "Billing",
    manual: "12 min",
    sets: [
      { field: "Invoice", value: "INV-8912" },
      { field: "Status", value: "Confirmed" },
    ],
  },
  {
    n: 7,
    title: "Dashboard updated",
    what: "Revenue, pipeline and stock move in the same moment — no evening reconciliation.",
    where: "Dashboards",
    manual: "20 min/day",
    sets: [
      { field: "Pipeline", value: "+₹1,70,000" },
      { field: "Stock reserved", value: "4 units" },
    ],
  },
];

/** Rounded up from the per-step manual timings above, excluding the approval wait. */
export const manualTimeSaved = "~44 minutes per enquiry";
