import type { ProjectStatus } from "./project-status";

export type CaseStudy = {
  slug: string;
  /** What this project actually is. Never leave a concept looking like delivered work. */
  status: ProjectStatus;
  title: string;
  client: string;
  industry: string;
  industrySlug: string;
  summary: string;
  challenge: string[];
  understanding: string[];
  solution: string[];
  architecture: { layer: string; detail: string }[];
  features: string[];
  screens: string[];
  automation: string[];
  analytics: string[];
  outcome: string[];
  future: string[];
  tech: string[];
  testimonial?: { quote: string; author: string };
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "industrial-business-system",
    status: "concept",
    title: "Industrial business system: sales, service and warranty in one platform",
    client: "Manufacturing company",
    industry: "Manufacturing",
    industrySlug: "manufacturing",
    summary:
      "Replaced a stack of spreadsheets with a single system covering leads, orders, inventory, service jobs and warranty.",
    challenge: [
      "Leads recorded in personal notebooks and WhatsApp",
      "Orders and dispatch tracked in multiple Excel files",
      "No reliable stock position at any point in the month",
      "Service history unavailable when a customer called",
      "Warranty claims judged from memory",
      "Management saw numbers only at month end",
    ],
    understanding: [
      "The bottleneck was not reporting; it was that the same data was entered three times in three places.",
      "Service and sales needed the same customer record, not two.",
      "Warranty depends on the dispatch date, so dispatch had to be the single source of truth.",
    ],
    solution: [
      "One customer and product master used by every module",
      "Lead-to-order pipeline with owner and stage",
      "Inventory movements tied to dispatch and service consumption",
      "Job cards for every service visit with parts and status",
      "Warranty computed from dispatch, visible to the service team",
      "Management dashboard refreshed continuously",
    ],
    architecture: [
      {
        layer: "Data",
        detail:
          "Relational database with customer, product, order, stock, job-card and warranty entities.",
      },
      {
        layer: "Application",
        detail: "Role-based web application for sales, stores, service and management.",
      },
      {
        layer: "Automation",
        detail: "Scheduled reminders, low-stock alerts and daily management summary.",
      },
      {
        layer: "Analytics",
        detail: "Live dashboards over the same database, no separate reporting file.",
      },
    ],
    features: [
      "CRM",
      "Order management",
      "Inventory",
      "Production tracking",
      "Service management",
      "Warranty tracking",
      "Job cards",
      "Role-based access",
      "Dashboards",
      "Alerts",
    ],
    screens: [
      "Sales pipeline",
      "Order & dispatch",
      "Stock ledger",
      "Job card",
      "Warranty lookup",
      "Management dashboard",
    ],
    automation: [
      "Follow-up reminders on stale leads",
      "Low-stock alerts to stores",
      "Job-card status updates to customers",
      "Daily summary to management",
    ],
    analytics: [
      "Sales by product and region",
      "Order-to-dispatch time",
      "Stock ageing",
      "Service load and repeat failures",
      "Warranty cost exposure",
    ],
    outcome: [
      "One record per customer across sales and service",
      "Stock position available on demand instead of month end",
      "Service history retrievable during the customer call",
      "Management visibility without asking for a report",
    ],
    future: [
      "Dealer portal",
      "Production scheduling",
      "Predictive service intervals",
      "Mobile app for field engineers",
    ],
    tech: ["React", "TypeScript", "PostgreSQL", "Role-based auth", "Scheduled jobs", "Dashboards"],
  },
  {
    slug: "clinic-digital-platform",
    status: "concept",
    title: "Clinic digital platform: presence, appointments and follow-ups",
    client: "Multi-doctor clinic",
    industry: "Healthcare & Clinics",
    industrySlug: "healthcare",
    summary:
      "A professional clinic website joined to appointment handling and automated patient reminders.",
    challenge: [
      "All appointments handled on phone during consulting hours",
      "Patients could not find doctor availability or services online",
      "Frequent no-shows",
      "Follow-up advice not tracked after the visit",
    ],
    understanding: [
      "The front desk was the bottleneck, not the doctors.",
      "Most enquiries were three repeated questions: timings, services and fees.",
      "Reminders had to reach patients where they already read messages.",
    ],
    solution: [
      "Clinic website with doctors, services and clear information",
      "Online appointment requests with slot handling",
      "Reception dashboard to confirm or reschedule",
      "Automated reminders and follow-up messages",
    ],
    architecture: [
      { layer: "Data", detail: "Patients, doctors, slots, appointments, follow-ups." },
      { layer: "Application", detail: "Public site plus reception and doctor views." },
      { layer: "Automation", detail: "Reminder and follow-up message schedules." },
      { layer: "Analytics", detail: "Consultation volume, source of appointment, no-show rate." },
    ],
    features: [
      "Clinic website",
      "Online appointments",
      "Reception dashboard",
      "Patient records",
      "Reminders",
      "Reporting",
    ],
    screens: ["Home", "Doctor profile", "Booking flow", "Reception queue", "Daily schedule"],
    automation: [
      "Appointment confirmation",
      "Day-before reminder",
      "Post-visit follow-up",
      "Missed-appointment nudge",
    ],
    analytics: ["Appointments per doctor", "No-show rate", "Enquiry source", "Peak-hour load"],
    outcome: [
      "Fewer repeat phone calls",
      "Bookings possible outside clinic hours",
      "Reminders sent without staff effort",
      "Clear daily schedule for each doctor",
    ],
    future: [
      "Patient login with history",
      "Digital prescriptions",
      "Payment collection",
      "Teleconsultation",
    ],
    tech: ["React", "TypeScript", "PostgreSQL", "WhatsApp automation", "Scheduled jobs"],
  },
  {
    slug: "restaurant-customer-platform",
    status: "concept",
    title: "Restaurant customer platform: capture, loyalty and repeat visits",
    client: "Restaurant group",
    industry: "Restaurants & Food Businesses",
    industrySlug: "restaurants",
    summary:
      "Turned anonymous walk-in footfall into a customer database with measurable repeat visits.",
    challenge: [
      "Hundreds of customers daily, no customer data",
      "Marketing dependent on aggregator platforms",
      "Offers broadcast without knowing who received them",
      "No idea which customers actually return",
    ],
    understanding: [
      "Customers will share a number for a clear, immediate benefit — not for a newsletter.",
      "Capture must happen at the table in under fifteen seconds.",
    ],
    solution: [
      "QR capture at every table",
      "Loyalty tracking against phone number",
      "Segmented WhatsApp campaigns",
      "Menu and offers site",
      "Customer analytics",
    ],
    architecture: [
      { layer: "Data", detail: "Customers, visits, rewards, campaigns." },
      { layer: "Application", detail: "Mobile-first capture page and manager console." },
      { layer: "Automation", detail: "Reward messages, birthday and win-back campaigns." },
      { layer: "Analytics", detail: "Visit frequency, segment performance, campaign response." },
    ],
    features: ["QR customer capture", "Loyalty", "Campaign console", "Menu site", "Analytics"],
    screens: [
      "QR capture",
      "Reward status",
      "Campaign builder",
      "Customer segments",
      "Manager dashboard",
    ],
    automation: [
      "Welcome message",
      "Reward unlocked alert",
      "Win-back after inactivity",
      "Festival campaigns",
    ],
    analytics: [
      "New vs repeat customers",
      "Visit frequency",
      "Campaign conversion",
      "Outlet comparison",
    ],
    outcome: [
      "An owned customer database instead of aggregator dependence",
      "Campaigns targeted by behaviour",
      "Repeat visits measurable for the first time",
    ],
    future: [
      "Table ordering",
      "Online payments",
      "Reservation management",
      "Franchise-level reporting",
    ],
    tech: ["React", "PostgreSQL", "WhatsApp Business API", "Analytics dashboards"],
  },
  {
    slug: "finance-lead-platform",
    status: "concept",
    title: "Finance platform: calculators, education and disciplined follow-up",
    client: "Loans & insurance business",
    industry: "Finance & Insurance",
    industrySlug: "finance-insurance",
    summary:
      "A lead engine where customers self-qualify through calculators before a single call is made.",
    challenge: [
      "Leads lost between calls",
      "Customers did not understand product differences",
      "Documents collected over chat",
      "No structured follow-up",
    ],
    understanding: [
      "A customer who has run a calculator is a materially better lead than a form fill.",
      "Follow-up failure, not lead volume, was the revenue problem.",
    ],
    solution: [
      "Product education pages",
      "EMI and eligibility calculators",
      "Structured lead capture",
      "Lead pipeline with stages",
      "Automated follow-up sequences",
    ],
    architecture: [
      { layer: "Data", detail: "Leads, products, calculations, documents, activities." },
      { layer: "Application", detail: "Public site plus internal lead console." },
      { layer: "Automation", detail: "Stage-based reminders and document requests." },
      { layer: "Analytics", detail: "Source, stage conversion, agent performance." },
    ],
    features: [
      "Calculators",
      "Lead capture",
      "Lead management",
      "Document upload",
      "Follow-up automation",
      "Dashboards",
    ],
    screens: ["Product page", "Calculator", "Application form", "Lead pipeline", "Agent dashboard"],
    automation: [
      "Instant acknowledgement",
      "Document reminder",
      "Stage-based follow-ups",
      "Idle-lead escalation",
    ],
    analytics: [
      "Lead source quality",
      "Stage-wise drop-off",
      "Response time",
      "Conversion by product",
    ],
    outcome: [
      "Better qualified enquiries",
      "No lead left without a next action",
      "Clear view of where deals stall",
    ],
    future: [
      "Credit-check integration",
      "Digital KYC",
      "Customer portal",
      "Partner referral tracking",
    ],
    tech: ["React", "TypeScript", "PostgreSQL", "Automation workflows"],
  },
  {
    slug: "veterinary-ecosystem",
    status: "concept",
    title: "Veterinary ecosystem: doctors, customers and appointments in one platform",
    client: "Veterinary network",
    industry: "Veterinary & Pet Services",
    industrySlug: "veterinary",
    summary:
      "A connected platform linking pet owners, doctors, appointments, prescriptions and services.",
    challenge: [
      "Records fragmented per clinic",
      "Appointments handled manually",
      "No prescription history for a pet",
      "No repeat engagement with owners",
    ],
    understanding: [
      "The pet, not the visit, is the record that matters.",
      "Doctors needed history in seconds, not a search through registers.",
    ],
    solution: [
      "Pet-centric records",
      "Doctor portal",
      "Owner-facing booking",
      "Digital prescriptions",
      "Service catalogue and marketplace structure",
    ],
    architecture: [
      { layer: "Data", detail: "Owners, pets, doctors, appointments, prescriptions, services." },
      { layer: "Application", detail: "Owner app, doctor portal, admin console." },
      { layer: "Automation", detail: "Vaccination and follow-up reminders." },
      { layer: "Analytics", detail: "Appointment volume, service mix, doctor utilisation." },
    ],
    features: [
      "Pet records",
      "Appointments",
      "Prescriptions",
      "Doctor portal",
      "Service marketplace",
      "Reminders",
    ],
    screens: ["Pet profile", "Booking", "Consultation", "Prescription", "Admin console"],
    automation: ["Vaccination due reminders", "Appointment confirmations", "Follow-up prompts"],
    analytics: ["Appointments per doctor", "Service demand", "Repeat visit rate"],
    outcome: [
      "Full history available at consultation",
      "Owners book without calling",
      "Reminders drive preventive visits",
    ],
    future: [
      "Pharmacy & product ordering",
      "Home-visit scheduling",
      "Payments",
      "Multi-city expansion",
    ],
    tech: ["React", "PostgreSQL", "Role-based auth", "Notification workflows"],
  },
  {
    slug: "farm-technology",
    status: "concept",
    title: "Farm technology: digital presence with practical field monitoring",
    client: "Agriculture business",
    industry: "Agriculture",
    industrySlug: "agriculture",
    summary:
      "A credible online presence combined with simple field data capture and operational dashboards.",
    challenge: [
      "No online credibility with buyers",
      "Field records on paper",
      "Monitoring done by phone calls",
      "Cost per acre unknown",
    ],
    understanding: [
      "Data entry had to work on a low-end phone with poor connectivity.",
      "Only a few numbers actually drive decisions.",
    ],
    solution: [
      "Business website",
      "Mobile-first field data capture",
      "Operations dashboard",
      "Automated reports",
    ],
    architecture: [
      { layer: "Data", detail: "Plots, activities, inputs, costs, yields." },
      { layer: "Application", detail: "Public site and field capture PWA." },
      { layer: "Automation", detail: "Scheduled activity reminders and weekly reports." },
      { layer: "Analytics", detail: "Cost per acre, activity compliance, yield trend." },
    ],
    features: [
      "Website",
      "Field data capture",
      "Monitoring dashboard",
      "Scheduled reports",
      "Offline-tolerant entry",
    ],
    screens: ["Home", "Plot list", "Activity entry", "Operations dashboard"],
    automation: ["Activity reminders", "Weekly summary report", "Threshold alerts"],
    analytics: ["Cost per acre", "Input usage", "Activity compliance", "Yield trend"],
    outcome: [
      "Field records digital and searchable",
      "Weekly numbers without collection effort",
      "Buyers can verify the business online",
    ],
    future: ["Sensor integration", "Buyer portal", "Traceability", "Forecasting"],
    tech: ["React", "PWA", "PostgreSQL", "Scheduled jobs"],
  },
];

export const caseStudyBySlug = (slug: string) => caseStudies.find((c) => c.slug === slug);
