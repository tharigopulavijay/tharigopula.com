import { priceLabel, tierById } from "./catalog";

export type PricingTier = {
  name: string;
  price: string;
  audience: string;
  includes: string[];
  note?: string;
  popular?: boolean;
};

export type PricingCategory = {
  key: string;
  title: string;
  blurb: string;
  tiers: PricingTier[];
};

// Legacy-compatible shape kept for any external consumers.
export type PricingRow = { name: string; range: string; note?: string };
export type PricingGroup = { title: string; blurb: string; rows: PricingRow[] };

export const pricingCategories: PricingCategory[] = [
  {
    key: "websites",
    title: "Websites",
    blurb:
      "Right-sized technology, priced by how much the site has to do — not by page count alone.",
    tiers: [
      {
        name: "Launch Page",
        price: priceLabel(tierById("launch")),
        audience: "Campaigns, new businesses, personal brands, single-service offers",
        includes: [
          "Single premium landing page",
          "Fully responsive layout",
          "WhatsApp click-to-chat",
          "Contact form",
          "Basic SEO setup",
          "Analytics integration",
          "Deployment",
          "One revision cycle",
        ],
      },
      {
        name: "Essential Business",
        price: priceLabel(tierById("essential")),
        audience: "Most small businesses that need a professional presence",
        includes: [
          "Up to ~5 core pages",
          "Responsive, professional UI",
          "Contact forms",
          "WhatsApp integration",
          "Basic SEO",
          "Analytics",
          "Performance optimisation",
          "Deployment",
        ],
        note: "Common functionality is included — never charged separately.",
        popular: true,
      },
      {
        name: "Dynamic Business",
        price: priceLabel(tierById("dynamic")),
        audience: "Businesses that need to manage content or bookings themselves",
        includes: [
          "Content management system",
          "Blog",
          "Catalogue / listings",
          "Dynamic services pages",
          "Basic database",
          "Enquiry management",
          "Booking capability",
          "Admin dashboard",
        ],
        popular: true,
      },
      {
        name: "Premium Interactive",
        price: priceLabel(tierById("premium")),
        audience: "Brands that want a distinctive, high-craft digital presence",
        includes: [
          "Custom UI design",
          "Premium interactions",
          "Scroll animation",
          "Micro-interactions",
          "Advanced typography",
          "Interactive storytelling",
          "Custom components",
        ],
        popular: true,
      },
      {
        name: "Cinematic Experience",
        price: priceLabel(tierById("cinematic")),
        audience: "Flagship brand or product sites built to be remembered",
        includes: [
          "Scroll-driven scenes",
          "Motion-led layouts",
          "Advanced transitions",
          "Visual narratives",
          "Media-rich presentation",
          "Advanced GSAP animation",
        ],
        note: "Custom video production or professional shoots are quoted separately.",
      },
      {
        name: "3D Interactive",
        price: priceLabel(tierById("threed")),
        audience: "Product-led brands that want immersive, spatial presentation",
        includes: [
          "Interactive 3D scene",
          "Product rotation",
          "Hotspots and callouts",
          "3D animation",
          "Product visualisation",
          "Scroll-linked 3D",
          "Configurator-style interaction",
        ],
        note: "Provided or basic 3D assets keep projects toward the lower end. Complex custom modelling, texturing, simulations or large-scale WebGL need separate quotation.",
      },
    ],
  },
  {
    key: "software",
    title: "Software",
    blurb: "Driven by modules, user roles, business rules and integrations.",
    tiers: [
      {
        name: "Small Internal System",
        price: "From ₹24,999",
        audience: "Teams replacing spreadsheets with a proper lean tool",
        includes: ["Core workflow digitised", "User accounts", "Basic reporting", "Deployment"],
      },
      {
        name: "CRM / Operations",
        price: "₹49,000 – ₹1,00,000+",
        audience: "Businesses managing leads, customers or day-to-day operations",
        includes: [
          "Custom CRM logic",
          "Role-based access",
          "Pipeline & task tracking",
          "Reporting",
          "Integrations",
        ],
        popular: true,
      },
      {
        name: "Multi-module Platform",
        price: "₹99,000 – ₹2,50,000+",
        audience: "Businesses running several connected functions in one system",
        includes: [
          "Multiple integrated modules",
          "Advanced permissions",
          "Workflow automation",
          "Custom reporting",
        ],
      },
      {
        name: "Large / Complex Systems",
        price: "Custom quotation",
        audience: "Organisation-wide platforms with significant scope",
        includes: ["Scoped after a detailed requirements discussion"],
      },
    ],
  },
  {
    key: "automation",
    title: "Automation",
    blurb: "Cost follows the number of steps, systems and exceptions involved.",
    tiers: [
      {
        name: "Simple Automation",
        price: "From ₹4,999",
        audience: "One repetitive task removed from someone's plate",
        includes: ["Form to sheet", "Email notification", "Reminders", "Basic data sync"],
      },
      {
        name: "Business Workflow",
        price: "₹9,999 – ₹24,999",
        audience: "A full process automated end to end",
        includes: [
          "Multi-step workflow",
          "Conditional logic",
          "Notifications",
          "Basic error handling",
        ],
        popular: true,
      },
      {
        name: "Multi-system Automation",
        price: "₹20,000 – ₹49,000",
        audience: "Automations that connect several tools you already use",
        includes: [
          "Multiple system integrations",
          "Data mapping",
          "Monitoring",
          "Exception handling",
        ],
      },
      {
        name: "AI Automation",
        price: "₹29,000 – ₹75,000+",
        audience: "Workflows that need judgement, not just rules",
        includes: [
          "AI-assisted decisions",
          "Document or text processing",
          "Integrated workflow",
          "Monitoring",
        ],
        note: "Third-party platform and API costs are separate.",
      },
    ],
  },
  {
    key: "data",
    title: "Data",
    blurb: "Cost follows data sources, cleanliness and reporting depth.",
    tiers: [
      {
        name: "Simple Dashboard",
        price: "From ₹9,999",
        audience: "One clear view of the numbers that matter most",
        includes: ["Single data source", "Key metrics view", "Basic filters"],
      },
      {
        name: "Management Dashboard",
        price: "₹19,000 – ₹39,000",
        audience: "Teams that need a shared operating view",
        includes: ["Multiple views", "Role-based access", "Scheduled refresh", "Export"],
        popular: true,
      },
      {
        name: "Multi-source Analytics",
        price: "₹35,000 – ₹75,000+",
        audience: "Businesses combining data from several systems",
        includes: ["Multiple data sources", "Data cleaning", "Advanced visualisations", "Alerts"],
      },
      {
        name: "Data Platform / Complex BI",
        price: "Custom quotation",
        audience: "Organisation-wide reporting and analytics infrastructure",
        includes: ["Scoped after a detailed requirements discussion"],
      },
    ],
  },
  {
    key: "ai",
    title: "AI",
    blurb: "Third-party AI and API consumption is always billed separately, at actuals.",
    tiers: [
      {
        name: "Basic AI Assistant",
        price: "From ₹14,999",
        audience: "A focused assistant for one clear use case",
        includes: ["Single-purpose assistant", "Basic conversation flow", "Deployment"],
      },
      {
        name: "Knowledge / Business Assistant",
        price: "₹29,000 – ₹59,000+",
        audience: "An assistant trained on your own business content",
        includes: ["Knowledge base integration", "Business-specific responses", "Basic analytics"],
        popular: true,
      },
      {
        name: "AI Document / OCR Workflow",
        price: "₹39,000 – ₹79,000+",
        audience: "Automating reading, extracting and processing documents",
        includes: ["Document ingestion", "OCR / extraction", "Validation workflow", "Integration"],
      },
      {
        name: "Advanced AI Platform",
        price: "Custom quotation",
        audience: "Multi-capability AI systems built around your business",
        includes: ["Scoped after a detailed requirements discussion"],
        note: "AI API usage is separate.",
      },
    ],
  },
  {
    key: "apps",
    title: "Apps",
    blurb: "Store accounts, device testing and release cycles are part of the scope.",
    tiers: [
      {
        name: "PWA / Lightweight App",
        price: "From ₹39,000",
        audience: "A lean, installable business app without native store overhead",
        includes: ["Installable web app", "Core business features", "Responsive across devices"],
      },
      {
        name: "Cross-platform MVP",
        price: "₹69,000 – ₹1,50,000+",
        audience: "A real first version of a customer-facing or internal app",
        includes: ["iOS and Android from one codebase", "Core feature set", "Backend integration"],
        popular: true,
      },
      {
        name: "Complex Mobile Platform",
        price: "₹1,50,000+",
        audience: "Feature-rich apps with significant backend complexity",
        includes: ["Scoped after a detailed requirements discussion"],
      },
    ],
  },
];

// Legacy export retained for backward compatibility.
export const pricingGroups: PricingGroup[] = pricingCategories.map((c) => ({
  title: c.title,
  blurb: c.blurb,
  rows: c.tiers.map((t) =>
    t.note ? { name: t.name, range: t.price, note: t.note } : { name: t.name, range: t.price },
  ),
}));

export const costFactors = [
  "Complexity of the business logic",
  "Number of screens and pages",
  "Depth of design and motion",
  "User roles and permissions",
  "Database requirements",
  "Third-party integrations",
  "Automation workflows",
  "AI capability",
  "Mobile application requirements",
  "Security requirements",
  "Reporting and analytics",
  "Animations",
  "3D and WebGL",
  "Deployment environment",
  "Support requirements",
];

export const supportPlans = [
  {
    name: "Website Care",
    price: "₹999/month",
    points: [
      "Monitoring",
      "Backup checks",
      "Small text and image updates",
      "Basic technical support",
    ],
  },
  {
    name: "Business Care",
    price: "₹2,499/month",
    points: [
      "Everything in Website Care",
      "Priority support",
      "Regular updates",
      "Database checks",
      "Performance checks",
      "Small improvements",
    ],
    featured: true,
  },
  {
    name: "Managed Systems",
    price: "₹4,999/month",
    points: [
      "For CRM, business software, automation and dashboards",
      "Monitoring and technical support",
      "Bug fixes",
      "Minor enhancements",
      "Workflow checks",
      "Monthly health review",
    ],
  },
  {
    name: "Technology Partner",
    price: "₹9,999+/month",
    points: [
      "Continuous improvement",
      "Automation optimisation",
      "Analytics support",
      "System enhancements",
      "Priority support",
      "Monthly technology review",
    ],
  },
];

export const thirdPartyCosts = [
  "Domain",
  "Hosting",
  "Database",
  "Cloud services",
  "Email provider",
  "SMS",
  "WhatsApp API",
  "Payment gateways",
  "AI APIs",
  "Maps",
  "Cloud storage",
  "App-store accounts",
  "Commercial licences",
  "Automation platforms",
  "3D tooling",
];
