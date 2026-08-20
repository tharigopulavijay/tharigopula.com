/**
 * The four pillars the business is sold through.
 *
 * The six capability groups underneath are still true, but six top-level
 * choices is more than a visitor weighs at once — and several of them overlap
 * in a buyer's mind anyway ("automation" and "AI" are one thought until you are
 * already technical). Four pillars, each with the concrete deliverables listed
 * underneath, gives someone a place to point at within a few seconds.
 *
 * Each pillar owns an accent so the four cards read as distinct products rather
 * than four repetitions of the same blue card.
 */

export type Pillar = {
  id: "web" | "software" | "automation" | "data";
  title: string;
  body: string;
  /** The concrete things actually delivered under this pillar. */
  includes: string[];
  /** Where "Learn more" goes. */
  to: string;
  /** Accent, used for the icon tint and the checkmarks. */
  accent: string;
  accentSoft: string;
};

export const pillars: Pillar[] = [
  {
    id: "web",
    title: "Websites & Digital Presence",
    body: "High-performing websites and digital experiences that attract customers and build your brand.",
    includes: [
      "Conversion-focused websites",
      "E-commerce stores",
      "Landing pages",
      "Website maintenance",
      "Speed, SEO & security",
    ],
    to: "/website-studio",
    accent: "#2563EB",
    accentSoft: "#E8F0FE",
  },
  {
    id: "software",
    title: "Business Software & Apps",
    body: "Custom software and apps built around your workflow to streamline operations and improve productivity.",
    includes: [
      "CRM & customer management",
      "Inventory & order management",
      "Billing & invoicing",
      "HR & employee management",
      "Custom web & mobile apps",
    ],
    to: "/demo/platform",
    accent: "#0EA36B",
    accentSoft: "#E3F5ED",
  },
  {
    id: "automation",
    title: "Automation & Integrations",
    body: "Automate repetitive tasks and connect the tools you use to save time, reduce errors and scale your business.",
    includes: [
      "Workflow automation",
      "System integrations",
      "API development",
      "WhatsApp & email automation",
      "Approvals & notifications",
    ],
    to: "/demo/platform",
    accent: "#E08411",
    accentSoft: "#FDF0DC",
  },
  {
    id: "data",
    title: "Data, Dashboards & AI",
    body: "Turn your data into insights with powerful dashboards and AI solutions that support better decisions.",
    includes: [
      "Real-time dashboards",
      "Advanced reporting",
      "Data analysis",
      "AI insights & predictions",
      "AI chatbots & assistants",
    ],
    to: "/solutions",
    accent: "#7C4DDA",
    accentSoft: "#F0EAFC",
  },
];

export const pillarById = (id: Pillar["id"]) => pillars.find((p) => p.id === id)!;
