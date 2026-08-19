/**
 * The single source of truth for what Tharigopula sells and what it costs.
 *
 * Before this file existed, every website tier's price was written out by hand
 * in five separate places — the pricing page, the Website Studio, the Experience
 * Lab, the estimator and the industry playbooks. They had already drifted: the
 * pricing page advertised Cinematic at up to ₹79,999 while the estimator quoted
 * a ceiling of ₹59,999, and 3D differed by ₹45,000. A visitor could read one
 * number and be quoted another.
 *
 * Everything downstream now derives from here. Change a price once, and the
 * pricing page, studio, lab, estimator and industry pages all move together.
 */

export type TierId = "launch" | "essential" | "dynamic" | "premium" | "cinematic" | "threed";

export type Tier = {
  id: TierId;
  /** Canonical display name. Used everywhere so the same product is never called two things. */
  name: string;
  /** Compact label for tabs and narrow cards. */
  short: string;
  /** Website Studio category slug this tier corresponds to. */
  categorySlug: string;
  low: number;
  high: number;
  /** True where scope genuinely has no upper bound — renders a trailing "+". */
  openEnded?: boolean;
  /** True where the low figure is the honest headline ("From ₹6,999"). */
  fromOnly?: boolean;
  timeline: string;
};

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** "₹18,999 – ₹34,999", or "From ₹6,999", or "₹49,999 – ₹1,25,000+". */
export function priceLabel(t: Pick<Tier, "low" | "high" | "openEnded" | "fromOnly">): string {
  if (t.fromOnly) return `From ${inr(t.low)}`;
  return `${inr(t.low)} – ${inr(t.high)}${t.openEnded ? "+" : ""}`;
}

/** Just the entry point — "From ₹11,999". Used where space is tight. */
export const startingAt = (t: Pick<Tier, "low">) => `From ${inr(t.low)}`;

export const websiteTiers: Tier[] = [
  {
    id: "launch",
    name: "Launch Page",
    short: "Launch",
    categorySlug: "launch-page",
    low: 6999,
    high: 11999,
    fromOnly: true,
    timeline: "3 – 5 days",
  },
  {
    id: "essential",
    name: "Essential Business",
    short: "Essential",
    categorySlug: "essential",
    low: 11999,
    high: 17999,
    timeline: "1 – 2 weeks",
  },
  {
    id: "dynamic",
    name: "Dynamic Business",
    short: "Dynamic",
    categorySlug: "dynamic",
    low: 18999,
    high: 34999,
    timeline: "2 – 4 weeks",
  },
  {
    id: "premium",
    name: "Premium Interactive",
    short: "Interactive",
    categorySlug: "premium-interactive",
    low: 29999,
    high: 54999,
    timeline: "3 – 5 weeks",
  },
  {
    id: "cinematic",
    name: "Cinematic Experience",
    short: "Cinematic",
    categorySlug: "cinematic",
    low: 39999,
    high: 79999,
    timeline: "4 – 7 weeks",
  },
  {
    id: "threed",
    name: "3D Interactive",
    short: "3D Immersive",
    categorySlug: "immersive-3d",
    low: 49999,
    high: 125000,
    openEnded: true,
    timeline: "5 – 8 weeks",
  },
];

export const tierById = (id: TierId) => websiteTiers.find((t) => t.id === id)!;
export const tierByCategory = (slug: string) => websiteTiers.find((t) => t.categorySlug === slug);

/* ------------------------------------------------------------------ */
/* Software, automation, data and AI — same treatment.                 */
/* ------------------------------------------------------------------ */

export type SystemId =
  "software" | "crm" | "platform" | "dashboard" | "automation" | "ai" | "mobile";

export type SystemTier = {
  id: SystemId;
  name: string;
  low: number;
  high: number;
  openEnded?: boolean;
  fromOnly?: boolean;
};

export const systemTiers: SystemTier[] = [
  { id: "software", name: "Small internal system", low: 24999, high: 60000, fromOnly: true },
  { id: "crm", name: "CRM / Operations system", low: 49000, high: 100000, openEnded: true },
  { id: "platform", name: "Multi-module platform", low: 99000, high: 250000, openEnded: true },
  { id: "dashboard", name: "Dashboard & reporting", low: 9999, high: 39000 },
  { id: "automation", name: "Workflow automation", low: 4999, high: 24999, fromOnly: true },
  { id: "ai", name: "AI assistant", low: 14999, high: 59000, openEnded: true },
  { id: "mobile", name: "Mobile app / PWA", low: 39000, high: 150000, openEnded: true },
];

export const systemById = (id: SystemId) => systemTiers.find((s) => s.id === id)!;
