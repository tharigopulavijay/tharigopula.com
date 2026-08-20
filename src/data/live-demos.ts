import { priceLabel, tierById, systemById, inr } from "./catalog";

/**
 * The four demo categories, and what actually sits behind each one.
 *
 * `demoPath` is the thing a visitor lands on when they click through. It is
 * required, not optional, on purpose: a category card that leads nowhere is a
 * promise the site cannot keep, and this file is where that would be caught.
 */

export type DemoCategory = {
  slug: "mobile-apps" | "websites" | "business-software" | "automation";
  name: string;
  /** Shown on the gateway card — what the category is, in the visitor's terms. */
  blurb: string;
  /** The four or five things they will actually see inside. */
  previews: string[];
  /** Where the card's CTA goes. */
  to: string;
  cta: string;
  /** Indicative starting price, always read from the catalog. */
  startingFrom: string;
  accent: string;
};

export const demoCategories: DemoCategory[] = [
  {
    slug: "mobile-apps",
    name: "Mobile App Demos",
    blurb:
      "Open a working app in a real phone and tablet frame — ordering, booking, customer and business apps you can tap through.",
    previews: ["Ordering apps", "Booking apps", "Customer apps", "Business apps"],
    to: "/live-demos/mobile-apps",
    cta: "View Mobile Demos",
    startingFrom: `From ${inr(systemById("mobile").low)}`,
    accent: "#2563EB",
  },
  {
    slug: "websites",
    name: "Website Demos",
    blurb:
      "The same business built five times over, from a clean brochure site to a 3D interactive experience. This is what the website tiers mean, shown rather than described.",
    previews: ["Essential", "Dynamic", "Interactive", "Cinematic", "3D"],
    to: "/live-demos/websites",
    cta: "View Website Demos",
    startingFrom: priceLabel(tierById("essential")),
    accent: "#0EA36B",
  },
  {
    slug: "business-software",
    name: "Business Software Demos",
    blurb:
      "A complete business system you can click through — leads, customers, sales, purchases, stock, service and dashboards, with real records and five staff roles.",
    previews: ["CRM & leads", "Sales & purchases", "Stock & service", "Dashboards"],
    to: "/live-demos/business-software",
    cta: "View Software Demos",
    startingFrom: `From ${inr(systemById("crm").low)}`,
    accent: "#7C4DDA",
  },
  {
    slug: "automation",
    name: "Automation Demos",
    blurb:
      "Watch a lead move from a website form all the way to an updated dashboard without anyone touching it — step by step, at your own pace.",
    previews: ["Lead capture", "Notifications", "Approvals", "Reporting"],
    to: "/live-demos/automation",
    cta: "View Automation Demos",
    startingFrom: `From ${inr(systemById("automation").low)}`,
    accent: "#E08411",
  },
];

export const categoryBySlug = (slug: DemoCategory["slug"]) =>
  demoCategories.find((c) => c.slug === slug)!;

/**
 * The reassurance line under the hero. Commitments, not statistics — each one
 * is true on day one and none of them invites the reader to count clients.
 */
export const demoAssurances = [
  "No login required",
  "Preview real experiences",
  "See what we can build for you",
];
