export type SolutionGroup = {
  slug: string;
  title: string;
  summary: string;
  outcome: string;
  items: string[];
};

export const solutionGroups: SolutionGroup[] = [
  {
    slug: "digital-presence",
    title: "Digital Presence",
    summary: "How your business looks, explains itself and captures enquiries online.",
    outcome: "More qualified enquiries from people already searching for you.",
    items: [
      "Business websites",
      "Corporate websites",
      "Portfolio websites",
      "Landing pages",
      "E-commerce",
      "Customer portals",
      "Booking systems",
      "SEO-ready websites",
    ],
  },
  {
    slug: "business-software",
    title: "Custom Business Software",
    summary: "Systems that replace scattered spreadsheets, notebooks and WhatsApp threads.",
    outcome: "One place where sales, stock, service and customers actually live.",
    items: [
      "CRM",
      "ERP-style systems",
      "Sales management",
      "Inventory management",
      "Service management",
      "Billing",
      "Procurement",
      "Employee management",
      "Asset management",
      "Customer management",
    ],
  },
  {
    slug: "automation",
    title: "Automation",
    summary: "Work that repeats every day should not need a person every day.",
    outcome: "Fewer missed follow-ups, faster approvals, less manual re-typing.",
    items: [
      "WhatsApp automation",
      "Email automation",
      "Follow-up automation",
      "Reminders",
      "Approval workflows",
      "Document automation",
      "Data workflows",
      "Scheduled reports",
      "Business process automation",
    ],
  },
  {
    slug: "data-analytics",
    title: "Data & Analytics",
    summary: "Numbers you can trust, in one view, without waiting for month-end.",
    outcome: "Decisions based on what is actually happening in the business.",
    items: [
      "Executive dashboards",
      "Sales analytics",
      "Operations analytics",
      "Financial dashboards",
      "KPI tracking",
      "Database design",
      "Data integration",
      "ETL / data pipelines",
      "Cloud databases",
    ],
  },
  {
    slug: "ai-solutions",
    title: "AI Solutions",
    summary: "AI applied where it removes real manual effort — not as decoration.",
    outcome: "Hours of reading, typing and searching handled automatically.",
    items: [
      "AI assistants",
      "Business knowledge assistants",
      "AI chatbots",
      "OCR / document processing",
      "Intelligent search",
      "Automated reporting",
      "AI-powered workflows",
      "Data analysis assistants",
    ],
  },
  {
    slug: "applications",
    title: "Mobile & Web Applications",
    summary: "Focused apps for the people who use your business every day.",
    outcome: "Customers, staff and partners each get the screen they need.",
    items: [
      "Customer applications",
      "Employee applications",
      "Business applications",
      "Admin portals",
      "Vendor portals",
      "Partner portals",
      "Progressive web applications",
      "Android / iOS solutions",
    ],
  },
];

export type ProblemEntry = {
  slug: string;
  title: string;
  description: string;
  solutions: string[];
};

export const problemEntries: ProblemEntry[] = [
  {
    slug: "digital-presence",
    title: "Build my online presence",
    description: "Website, portfolio, landing page, booking system.",
    solutions: ["digital-presence"],
  },
  {
    slug: "business-software",
    title: "Manage my business better",
    description: "CRM, inventory, billing, service, operations.",
    solutions: ["business-software"],
  },
  {
    slug: "automation",
    title: "Automate repetitive work",
    description: "Notifications, approvals, follow-ups, reports, workflows.",
    solutions: ["automation"],
  },
  {
    slug: "data-analytics",
    title: "Understand my business",
    description: "Dashboards, KPIs, analytics, reporting.",
    solutions: ["data-analytics"],
  },
  {
    slug: "applications",
    title: "Build a customer application",
    description: "Web apps, portals, mobile applications.",
    solutions: ["applications"],
  },
  {
    slug: "ai-solutions",
    title: "Use AI in my business",
    description: "AI assistants, document processing, knowledge search, automation.",
    solutions: ["ai-solutions"],
  },
];

export const deliveryJourney = [
  { step: "Your business", note: "How it operates today." },
  { step: "Understand the problem", note: "Where time and money leak." },
  { step: "Design the solution", note: "Workflows, screens, data model." },
  { step: "Build", note: "The actual system." },
  { step: "Test", note: "Functionality, usability, reliability." },
  { step: "Deploy", note: "Live, with your team trained." },
  { step: "Automate", note: "Remove the repeating manual steps." },
  { step: "Measure", note: "Usage, output, business numbers." },
  { step: "Improve", note: "Change what the data tells you to change." },
];

export const process = [
  { id: "01", title: "Discover", body: "Understand the business, current workflow, pain points and goals." },
  { id: "02", title: "Design", body: "Plan user journeys, architecture and the solution shape." },
  { id: "03", title: "Prototype", body: "Demonstrate the experience before building everything." },
  { id: "04", title: "Build", body: "Develop the actual system." },
  { id: "05", title: "Test", body: "Functionality, usability, responsiveness and reliability." },
  { id: "06", title: "Deploy", body: "Production deployment and handover." },
  { id: "07", title: "Support & Improve", body: "Measure usage and improve where it is worth improving." },
];

export const capabilityStack = [
  { title: "Business understanding", body: "We map the workflow before we write a line of code." },
  { title: "Technology architecture", body: "Systems designed to grow as the business grows." },
  { title: "Data & analytics", body: "Clean data models, dependable reporting." },
  { title: "Automation", body: "Removing the repeating manual work first." },
  { title: "AI", body: "Applied only where it produces measurable savings." },
  { title: "UI / UX", body: "Interfaces staff and customers can use without training." },
  { title: "Ongoing support", body: "Optional, transparent, never forced." },
];

export const techCapabilities: Record<string, string[]> = {
  "Frontend & apps": ["React", "TypeScript", "Next-gen web", "Progressive web apps", "React Native"],
  "Backend & data": ["Node.js", "Python", "PostgreSQL", "Supabase", "REST & webhooks"],
  "Automation & AI": ["Workflow engines", "WhatsApp Business API", "OCR pipelines", "LLM assistants", "Vector search"],
  "Cloud & delivery": ["Managed cloud hosting", "CI/CD", "Monitoring", "Backups", "Role-based security"],
};

export const whyPoints = [
  { title: "Business-first approach", body: "The requirement is written in business language before it becomes a spec." },
  { title: "Custom solutions", body: "Built for your workflow, not bent to fit a product we resell." },
  { title: "Practical technology", body: "We recommend the smallest thing that solves the problem." },
  { title: "Scalable architecture", body: "Adding a module later does not mean rebuilding." },
  { title: "Data-driven thinking", body: "Every system is designed to produce usable numbers." },
  { title: "Transparent pricing", body: "Indicative ranges up front; third-party costs shown separately." },
  { title: "You own what we deliver", body: "Code, database and accounts belong to your business." },
  { title: "Long-term support", body: "Optional plans, no lock-in contracts." },
  { title: "One partner", body: "Website, software, data, automation and AI in one place." },
];
