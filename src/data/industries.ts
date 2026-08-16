export type Industry = {
  slug: string;
  name: string;
  tagline: string;
  challenges: string[];
  solutions: string[];
  caseStudy?: string;
};

export const industries: Industry[] = [
  {
    slug: "manufacturing",
    name: "Manufacturing",
    tagline: "Orders, stock, service and warranty in one system instead of six spreadsheets.",
    challenges: [
      "Leads managed manually",
      "Orders maintained in Excel",
      "Inventory visibility problems",
      "Service history unavailable",
      "Warranty tracking problems",
      "Management lacks real-time visibility",
    ],
    solutions: [
      "CRM",
      "Order management",
      "Inventory",
      "Production tracking",
      "Service management",
      "Warranty tracking",
      "Dashboards",
      "Automation",
    ],
    caseStudy: "industrial-business-system",
  },
  {
    slug: "healthcare",
    name: "Healthcare & Clinics",
    tagline: "A credible online presence plus appointment and follow-up workflows that run themselves.",
    challenges: [
      "Appointments handled entirely over calls",
      "Patients cannot find clear information online",
      "No-shows and missed follow-ups",
      "Records spread across registers",
      "No visibility of consultation volumes",
    ],
    solutions: [
      "Clinic website",
      "Online appointments",
      "Patient reminders",
      "Consultation records",
      "WhatsApp automation",
      "Reporting",
    ],
    caseStudy: "clinic-digital-platform",
  },
  {
    slug: "restaurants",
    name: "Restaurants & Food Businesses",
    tagline: "Capture the customers who already walked in, and bring them back.",
    challenges: [
      "No customer data despite hundreds of daily visitors",
      "Marketing depends on aggregators",
      "Offers sent blindly",
      "No view of repeat customers",
    ],
    solutions: ["QR customer capture", "Loyalty", "WhatsApp campaigns", "Menu & ordering site", "Customer analytics"],
    caseStudy: "restaurant-customer-platform",
  },
  {
    slug: "finance-insurance",
    name: "Finance & Insurance",
    tagline: "Educate, calculate, capture and follow up — without losing a lead.",
    challenges: [
      "Leads lost between calls",
      "Customers do not understand products",
      "Documents collected over WhatsApp",
      "No follow-up discipline",
    ],
    solutions: ["Financial calculators", "Lead capture", "Lead management", "Document collection", "Follow-up automation"],
    caseStudy: "finance-lead-platform",
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    tagline: "Present property properly and know which enquiry is worth a site visit.",
    challenges: ["Listings scattered", "Enquiries untracked", "Weak project presentation", "No site-visit pipeline"],
    solutions: ["Premium project sites", "Listing management", "Enquiry CRM", "Site-visit scheduling", "Dashboards"],
  },
  {
    slug: "veterinary",
    name: "Veterinary & Pet Services",
    tagline: "Doctors, customers, appointments and prescriptions in one connected ecosystem.",
    challenges: ["Fragmented records", "Manual appointment handling", "No prescription history", "No repeat engagement"],
    solutions: ["Doctor portal", "Customer app", "Appointments", "Prescriptions", "Service catalogue", "Marketplace ecosystem"],
    caseStudy: "veterinary-ecosystem",
  },
  {
    slug: "agriculture",
    name: "Agriculture",
    tagline: "Digital presence plus practical monitoring for farms and agri businesses.",
    challenges: ["No online credibility", "Field data on paper", "Manual monitoring", "No yield or cost visibility"],
    solutions: ["Business website", "Field data capture", "Monitoring dashboards", "Automation", "Reports"],
    caseStudy: "farm-technology",
  },
  {
    slug: "retail",
    name: "Retail",
    tagline: "Know your stock, your fast movers and your customers.",
    challenges: ["Stock guesswork", "Billing disconnected from inventory", "No customer database", "No sales analysis"],
    solutions: ["Inventory", "Billing", "E-commerce", "Loyalty", "Sales dashboards"],
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    tagline: "Look established, and stop managing clients from your inbox.",
    challenges: ["Enquiries in personal WhatsApp", "Proposal chaos", "No engagement tracking", "Manual invoicing"],
    solutions: ["Professional website", "Client portal", "Engagement tracking", "Document workflows", "Billing"],
  },
  {
    slug: "education",
    name: "Education",
    tagline: "Admissions, batches, fees and parent communication in one place.",
    challenges: ["Admission enquiries lost", "Fee tracking manual", "Parent updates ad hoc", "No attendance visibility"],
    solutions: ["Admissions CRM", "Batch management", "Fee tracking", "Parent notifications", "Dashboards"],
  },
  {
    slug: "logistics",
    name: "Logistics",
    tagline: "Trips, vehicles, costs and documents visible as they happen.",
    challenges: ["Trip records on paper", "Vehicle cost unclear", "Delivery proof missing", "Billing delays"],
    solutions: ["Trip management", "Vehicle & driver records", "Proof of delivery", "Cost analytics", "Automated billing"],
  },
  {
    slug: "local-businesses",
    name: "Local Businesses",
    tagline: "Be findable, be contactable, be booked.",
    challenges: ["No online presence", "Customers cannot book", "Enquiries only via calls", "No repeat marketing"],
    solutions: ["Essential website", "Booking", "WhatsApp enquiries", "Local SEO", "Review workflows"],
  },
  {
    slug: "startups",
    name: "Startups",
    tagline: "Get a credible product in front of real users quickly.",
    challenges: ["Idea not yet demonstrable", "Limited budget", "Needs to move fast", "Investor-ready presentation"],
    solutions: ["Landing page", "MVP web app", "Auth & payments", "Analytics", "Iteration support"],
  },
];

export const industryBySlug = (slug: string) => industries.find((i) => i.slug === slug);
