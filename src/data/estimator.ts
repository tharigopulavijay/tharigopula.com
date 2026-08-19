import { systemTiers, websiteTiers, type SystemId, type TierId } from "./catalog";

export type Option = { id: string; label: string; hint?: string };

export type Range = [number, number];

export type Base = {
  id: string;
  label: string;
  group: "website" | "software";
  base: Range;
  included: string[];
  hint?: string;
};

// Bundled-and-included items shown on every base as "Included" (never priced individually).
const standardIncluded = [
  "Responsive design",
  "Contact forms",
  "WhatsApp",
  "Basic SEO",
  "Analytics",
  "Deployment",
];
const standardIncludedWithCms = [...standardIncluded, "CMS-lite content editing"];

// Hints are the only thing written here. Names and prices come from the catalog
// so the estimator can never quote a figure the pricing page does not advertise.
const websiteHints: Record<TierId, string> = {
  launch: "A focused single-page site to get you online fast.",
  essential: "A complete small business website.",
  dynamic: "Content-driven site with editable sections.",
  premium: "Richer interactions and a distinctive design layer.",
  cinematic: "Motion-led, brand-first experience.",
  threed: "3D/immersive storytelling where it genuinely helps.",
};

const systemHints: Record<SystemId, string> = {
  software: "Custom internal tool tailored to how you work.",
  crm: "Manage leads, customers, sales and service in one place.",
  platform: "Several connected modules running the business end to end.",
  dashboard: "Reporting and visibility into your data.",
  automation: "Automate a repetitive manual process.",
  ai: "An AI assistant trained on your business.",
  mobile: "An installable mobile experience.",
};

export const bases: Base[] = [
  ...websiteTiers.map<Base>((t) => ({
    id: t.id,
    label: t.name,
    group: "website",
    base: [t.low, t.high],
    included:
      t.id === "launch" || t.id === "essential" ? standardIncluded : standardIncludedWithCms,
    hint: websiteHints[t.id],
  })),
  ...systemTiers.map<Base>((s) => ({
    id: s.id,
    label: s.name,
    group: "software",
    base: [s.low, s.high],
    included: standardIncluded,
    hint: systemHints[s.id],
  })),
];

export const objectives: Option[] = [
  { id: "customers", label: "Get more customers" },
  { id: "presence", label: "Improve online presence" },
  { id: "manage-customers", label: "Manage customers" },
  { id: "manage-sales", label: "Manage sales" },
  { id: "manage-employees", label: "Manage employees" },
  { id: "manage-inventory", label: "Manage inventory" },
  { id: "manage-service", label: "Manage service" },
  { id: "automate", label: "Automate work" },
  { id: "reports", label: "Build reports" },
  { id: "customer-app", label: "Build customer application" },
  { id: "ai", label: "Use AI" },
  { id: "other", label: "Something else" },
];

export type Module = {
  id: string;
  label: string;
  cost: Range | null; // null => quoted separately
  groups: Array<Base["group"]>;
  includedInBases?: string[];
};

export const modules: Module[] = [
  {
    id: "cms",
    label: "CMS",
    cost: [4000, 8000],
    groups: ["website"],
    includedInBases: ["dynamic", "premium", "cinematic", "threed"],
  },
  { id: "booking", label: "Booking", cost: [5000, 10000], groups: ["website", "software"] },
  { id: "auth", label: "Authentication", cost: [7000, 12000], groups: ["website", "software"] },
  {
    id: "accounts",
    label: "Customer accounts",
    cost: [8000, 15000],
    groups: ["website", "software"],
  },
  { id: "payments", label: "Payments", cost: [6000, 12000], groups: ["website", "software"] },
  { id: "admin", label: "Custom admin", cost: [10000, 25000], groups: ["website", "software"] },
  {
    id: "dbWorkflows",
    label: "Custom database workflows",
    cost: [8000, 20000],
    groups: ["software"],
  },
  {
    id: "dashboardModule",
    label: "Dashboard",
    cost: [10000, 25000],
    groups: ["website", "software"],
    includedInBases: ["dashboard"],
  },
  {
    id: "apiIntegration",
    label: "Custom API integration",
    cost: [5000, 20000],
    groups: ["website", "software"],
  },
  {
    id: "automationModule",
    label: "Workflow automation",
    cost: [8000, 25000],
    groups: ["software"],
    includedInBases: ["automation"],
  },
  {
    id: "aiAssistant",
    label: "AI assistant",
    cost: [15000, 30000],
    groups: ["website", "software"],
    includedInBases: ["ai"],
  },
  { id: "advanced3d", label: "Advanced custom 3D", cost: null, groups: ["website"] },
];

export function modulesFor(baseId: string) {
  const b = bases.find((x) => x.id === baseId);
  if (!b) return modules;
  return modules.filter((m) => m.groups.includes(b.group));
}

export type ComplexityFactor = { id: string; label: string; pct: Range };

export const complexityFactors: ComplexityFactor[] = [
  { id: "roles", label: "Multiple user roles / permissions", pct: [0.03, 0.06] },
  { id: "screens", label: "Many screens / modules (10+)", pct: [0.05, 0.1] },
  { id: "data", label: "Large data volume or high traffic", pct: [0.03, 0.08] },
  { id: "integrations", label: "Multiple third-party integrations", pct: [0.05, 0.1] },
  { id: "workflow", label: "Deep business logic / workflow", pct: [0.05, 0.12] },
  { id: "security", label: "Security / compliance requirements", pct: [0.04, 0.08] },
  { id: "admin", label: "Advanced admin functionality", pct: [0.04, 0.09] },
  { id: "ai", label: "AI-driven features", pct: [0.05, 0.12] },
  { id: "threed", label: "3D / immersive elements", pct: [0.06, 0.15] },
];

// Business size is captured as lead information only — it does not affect price.
export const businessSizes: Option[] = [
  { id: "solo", label: "Solo professional" },
  { id: "1-10", label: "1–10 employees" },
  { id: "11-50", label: "11–50 employees" },
  { id: "51-200", label: "51–200 employees" },
  { id: "200+", label: "200+ employees" },
];

export const timelines: (Option & { rush: Range })[] = [
  { id: "normal", label: "Normal timeline", rush: [0, 0] },
  { id: "flexible", label: "Flexible / no rush", rush: [0, 0] },
  { id: "urgent", label: "Urgent — need it fast", rush: [0.15, 0.25] },
];

export type EstimatorState = {
  base: string;
  industry: string;
  objective: string;
  modules: string[];
  complexity: string[];
  size: string;
  timeline: string;
};

export const emptyState: EstimatorState = {
  base: "",
  industry: "",
  objective: "",
  modules: [],
  complexity: [],
  size: "",
  timeline: "",
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export type BreakdownLine = {
  label: string;
  detail: string;
};

export type CrossSell = {
  id: string;
  label: string;
  range: string;
};

export function computeEstimate(state: EstimatorState) {
  const base = bases.find((b) => b.id === state.base);
  const baseLow = base?.base[0] ?? 0;
  const baseHigh = base?.base[1] ?? 0;

  let subtotalLow = baseLow;
  let subtotalHigh = baseHigh;

  const moduleLines: BreakdownLine[] = [];
  const includedLines: string[] = base ? [...base.included] : [];
  let hasQuotedSeparately = false;

  for (const id of state.modules) {
    const m = modules.find((x) => x.id === id);
    if (!m) continue;
    const alreadyIncluded = base && m.includedInBases?.includes(base.id);
    if (alreadyIncluded) {
      includedLines.push(m.label);
      continue;
    }
    if (m.cost === null) {
      hasQuotedSeparately = true;
      moduleLines.push({ label: m.label, detail: "Quoted separately" });
      continue;
    }
    subtotalLow += m.cost[0];
    subtotalHigh += m.cost[1];
    moduleLines.push({ label: m.label, detail: `+${inr(m.cost[0])} – ${inr(m.cost[1])}` });
  }

  // Complexity adjustment — modest, transparent, applied to the subtotal so far.
  let pctLow = 0;
  let pctHigh = 0;
  const chosenFactors = complexityFactors.filter((f) => state.complexity.includes(f.id));
  for (const f of chosenFactors) {
    pctLow += f.pct[0];
    pctHigh += f.pct[1];
  }
  const complexityLow = subtotalLow * pctLow;
  const complexityHigh = subtotalHigh * pctHigh;
  const runningLow = subtotalLow + complexityLow;
  const runningHigh = subtotalHigh + complexityHigh;

  // Urgency — applied last, clearly labelled.
  const time = timelines.find((t) => t.id === state.timeline);
  const rushLow = time ? runningLow * time.rush[0] : 0;
  const rushHigh = time ? runningHigh * time.rush[1] : 0;
  const finalLow = runningLow + rushLow;
  const finalHigh = runningHigh + rushHigh;

  const moduleCount = state.modules.length;
  const complexity =
    finalHigh > 90000 || moduleCount > 6
      ? "Very high"
      : finalHigh > 55000 || moduleCount > 4
        ? "High"
        : finalHigh > 25000 || moduleCount > 2
          ? "Medium"
          : "Low";

  const weeks =
    complexity === "Very high"
      ? "10–16 weeks"
      : complexity === "High"
        ? "6–10 weeks"
        : complexity === "Medium"
          ? "3–6 weeks"
          : "1–3 weeks";

  // Cross-sell suggestions based on what wasn't picked yet.
  const crossSellCatalog: CrossSell[] = [
    { id: "auth-enquiry", label: "Customer enquiry management", range: "+₹5,000 – ₹10,000" },
    { id: "wa-followup", label: "WhatsApp follow-up automation", range: "+₹8,000 – ₹25,000" },
    { id: "crm", label: "CRM to manage leads & customers", range: "+₹49,000 – ₹1,00,000" },
    { id: "booking", label: "Booking / appointments", range: "+₹5,000 – ₹10,000" },
    { id: "inventory", label: "Inventory tracking", range: "+₹8,000 – ₹20,000" },
    { id: "dashboardModule", label: "Reporting dashboard", range: "+₹10,000 – ₹25,000" },
    { id: "aiAssistant", label: "AI assistant", range: "+₹15,000 – ₹30,000" },
    { id: "automationModule", label: "Workflow automation", range: "+₹8,000 – ₹25,000" },
    { id: "accounts", label: "Customer login / accounts", range: "+₹8,000 – ₹15,000" },
  ];
  const alreadyHave = new Set([...state.modules, ...includedLines.map((l) => l.toLowerCase())]);
  const crossSell = crossSellCatalog.filter((c) => !alreadyHave.has(c.id)).slice(0, 4);

  return {
    base,
    baseLine: base
      ? {
          label: `Base experience — ${base.label}`,
          detail: `${inr(base.base[0])} – ${inr(base.base[1])}`,
        }
      : null,
    includedLines: Array.from(new Set(includedLines)),
    moduleLines,
    complexityLine:
      chosenFactors.length > 0
        ? {
            label: "Complexity adjustment",
            detail: `+${inr(complexityLow)} – ${inr(complexityHigh)}`,
            factors: chosenFactors.map((f) => f.label),
          }
        : null,
    rushLine:
      time && time.id === "urgent"
        ? {
            label: "Urgency / rush adjustment (15–25%)",
            detail: `+${inr(rushLow)} – ${inr(rushHigh)}`,
          }
        : null,
    lowLabel: inr(finalLow),
    highLabel: inr(finalHigh),
    complexity,
    weeks,
    hasQuotedSeparately,
    crossSell,
  };
}
