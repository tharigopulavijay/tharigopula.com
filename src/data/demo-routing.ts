import { businesses } from "./demo-platform";

/**
 * Connects the site's thirteen industries to the six businesses the platform
 * demo can actually run.
 *
 * Six industries map exactly. The other seven do not have their own demo yet,
 * so they borrow the closest workflow — a vet clinic runs the same
 * patient/appointment/follow-up shape as a medical clinic, a logistics firm the
 * same order/dispatch shape as a manufacturer.
 *
 * Where a demo is borrowed we say so on the page rather than quietly showing
 * someone another industry's dashboard and hoping they do not notice.
 */

export type DemoMatch = {
  /** Business slug the demo should open with. */
  business: string;
  /** True when this industry has a demo built for it specifically. */
  exact: boolean;
  /** Shown when the demo is borrowed, explaining why it still applies. */
  note?: string;
};

const EXACT = new Set(businesses.map((b) => b.slug));

const BORROWED: Record<string, { business: string; note: string }> = {
  veterinary: {
    business: "healthcare",
    note: "Shown with a clinic, which runs the same shape of workflow — records, appointments, follow-ups and reminders. A veterinary build swaps patients for pets and adds vaccination schedules.",
  },
  "finance-insurance": {
    business: "professional-services",
    note: "Shown with an advisory firm, which shares the structure — enquiries, documents, engagements and deadlines. A finance build adds applications, eligibility and renewals.",
  },
  agriculture: {
    business: "manufacturing",
    note: "Shown with a manufacturer, which shares the structure — dealers, stock, dispatch and territory. An agriculture build adds seasons, batches and expiry.",
  },
  logistics: {
    business: "manufacturing",
    note: "Shown with a manufacturer, which shares the structure — orders, dispatch and billing. A logistics build adds trips, vehicles and proof of delivery.",
  },
  education: {
    business: "professional-services",
    note: "Shown with a professional firm, which shares the structure — enquiries, engagements and scheduled work. An education build adds batches, attendance and fee collection.",
  },
  "local-businesses": {
    business: "restaurants",
    note: "Shown with a restaurant, which shares the structure — enquiries, bookings, reminders and repeat customers. Most local services run this same shape.",
  },
  startups: {
    business: "professional-services",
    note: "Shown with a services firm. A startup build usually starts narrower — signups, onboarding and usage — before it needs this much.",
  },
};

/** Resolves any industry slug to a demo business. Never returns undefined. */
export function demoForIndustry(industrySlug: string): DemoMatch {
  if (EXACT.has(industrySlug)) return { business: industrySlug, exact: true };
  const borrowed = BORROWED[industrySlug];
  if (borrowed) return { business: borrowed.business, exact: false, note: borrowed.note };
  return { business: businesses[0]!.slug, exact: false };
}

/** Deep link into the platform demo, pre-configured for an industry. */
export const demoLinkFor = (industrySlug: string) =>
  `/demo/platform?industry=${encodeURIComponent(industrySlug)}`;

/** Deep link into the estimator, pre-filled for an industry. */
export const estimatorLinkFor = (industrySlug: string, base?: string) =>
  `/start-project?industry=${encodeURIComponent(industrySlug)}${base ? `&base=${encodeURIComponent(base)}` : ""}`;

/** True when a real, industry-specific demo exists. */
export const hasExactDemo = (industrySlug: string) => EXACT.has(industrySlug);
