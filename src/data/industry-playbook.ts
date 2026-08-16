/**
 * Industry playbooks.
 *
 * The industry pages previously listed challenges and a bag of solution names.
 * A visitor could not tell what it would cost, which website level suited them,
 * or what to do after the website. These playbooks answer that per industry:
 * the business objective, the right starting point, what automation actually
 * removes work, and which systems follow once the website is live.
 *
 * Additive by design — industries without a playbook keep rendering as before.
 */

export type AutomationExample = {
  trigger: string;
  outcome: string;
};

export type SystemOpportunity = {
  name: string;
  body: string;
  from: string;
};

export type IndustryPlaybook = {
  /** Business outcome in the owner's language, not ours. */
  objective: string;
  /** Website Studio category slugs that genuinely suit this industry. */
  levels: string[];
  /** Realistic entry point for this industry. */
  startingFrom: string;
  /** Website functionality this industry actually uses. */
  functionality: string[];
  automations: AutomationExample[];
  /** Where the relationship goes after the website. */
  systems: SystemOpportunity[];
};

export const industryPlaybooks: Record<string, IndustryPlaybook> = {
  manufacturing: {
    objective:
      "Stop losing dealer enquiries, and know the real stock and order position without waiting for month-end.",
    levels: ["essential", "dynamic", "immersive-3d"],
    startingFrom: "₹11,999",
    functionality: [
      "Product catalogue with specifications",
      "Downloadable spec sheets and manuals",
      "Dealer enquiry routing",
      "Application / use-case pages",
      "Multi-location contact",
      "3D product visualisation where it helps",
    ],
    automations: [
      { trigger: "A dealer submits an enquiry", outcome: "Logged, assigned to a sales owner, acknowledged on WhatsApp" },
      { trigger: "A quotation goes unopened for 3 days", outcome: "Polite follow-up sent automatically" },
      { trigger: "Stock drops below reorder level", outcome: "Purchase team alerted with the shortfall" },
      { trigger: "An invoice crosses 30 days", outcome: "Payment reminder with statement attached" },
    ],
    systems: [
      { name: "Order & dispatch management", body: "One place for orders, production status and dispatch instead of several Excel files.", from: "From ₹49,000" },
      { name: "Inventory & warranty", body: "Live stock position, plus serial-level service and warranty history when a customer calls.", from: "From ₹49,000" },
      { name: "Management dashboard", body: "Sales, collections and stock in one daily view.", from: "From ₹19,000" },
    ],
  },

  healthcare: {
    objective:
      "Fill the appointment book without the front desk living on the phone, and cut no-shows.",
    levels: ["essential", "dynamic"],
    startingFrom: "₹11,999",
    functionality: [
      "Doctor and speciality profiles",
      "Online appointment booking",
      "Treatment and pricing information",
      "Patient information and pre-visit forms",
      "Clinic timings and directions",
      "Reviews and trust signals",
    ],
    automations: [
      { trigger: "A patient books online", outcome: "Confirmation with date, time and location on WhatsApp" },
      { trigger: "24 hours before the appointment", outcome: "Reminder with a one-tap reschedule link" },
      { trigger: "A treatment session completes", outcome: "Next session reminder plus aftercare instructions" },
      { trigger: "Treatment closes", outcome: "Feedback request and a review link" },
    ],
    systems: [
      { name: "Appointment & patient records", body: "Consultation history, prescriptions and documents searchable in seconds.", from: "From ₹49,000" },
      { name: "Billing & packages", body: "Instalments, treatment packages and what has actually been collected.", from: "From ₹24,999" },
      { name: "Clinic dashboard", body: "Consultation volumes, revenue per doctor, no-show rate.", from: "From ₹19,000" },
    ],
  },

  restaurants: {
    objective:
      "Turn the people who already found you into bookings, and bring them back a second time.",
    levels: ["essential", "dynamic", "cinematic"],
    startingFrom: "₹11,999",
    functionality: [
      "Menu that you update yourself",
      "Table reservations",
      "Gallery and ambience",
      "QR menu for tables",
      "Events and private dining enquiries",
      "Directions and timings",
    ],
    automations: [
      { trigger: "A booking is confirmed", outcome: "Confirmation with map, timing and party size" },
      { trigger: "3 hours before the booking", outcome: "Reminder with one-tap cancel, so tables are not lost" },
      { trigger: "A guest finishes dining", outcome: "Thank you message and a Google review link" },
      { trigger: "An ingredient falls below par level", outcome: "Kitchen purchase list updated" },
    ],
    systems: [
      { name: "Reservation & guest history", body: "Who is a regular, what they ordered, which table they prefer.", from: "From ₹24,999" },
      { name: "Menu costing & inventory", body: "Ingredient cost per dish and where margin is leaking.", from: "From ₹24,999" },
      { name: "Outlet dashboard", body: "Covers, average bill and no-show rate per day.", from: "From ₹9,999" },
    ],
  },

  "finance-insurance": {
    objective:
      "Build enough trust online that qualified applicants start the process themselves.",
    levels: ["essential", "dynamic", "premium-interactive"],
    startingFrom: "₹18,999",
    functionality: [
      "Product and eligibility pages",
      "EMI and premium calculators",
      "Secure document upload",
      "Application forms with validation",
      "Compliance and regulatory disclosures",
      "Advisor booking",
    ],
    automations: [
      { trigger: "An application is submitted", outcome: "Routed to the right advisor with documents attached" },
      { trigger: "Documents are incomplete", outcome: "Automatic checklist of exactly what is missing" },
      { trigger: "An application stalls for 5 days", outcome: "Follow-up to the applicant and a nudge to the advisor" },
      { trigger: "A policy or renewal approaches", outcome: "Renewal reminder well before expiry" },
    ],
    systems: [
      { name: "Lead & application pipeline", body: "Every applicant with a stage, an owner and a next action.", from: "From ₹49,000" },
      { name: "Document management", body: "KYC and supporting documents stored against the right customer.", from: "From ₹24,999" },
      { name: "Portfolio dashboard", body: "Disbursals, renewals due and advisor performance.", from: "From ₹19,000" },
    ],
  },

  "real-estate": {
    objective:
      "Get serious buyers to a site visit, and stop portal enquiries going cold overnight.",
    levels: ["dynamic", "cinematic", "immersive-3d"],
    startingFrom: "₹18,999",
    functionality: [
      "Project and unit listings",
      "Floor plans and specifications",
      "Location and connectivity",
      "Site-visit booking",
      "Video walkthroughs",
      "3D or virtual tours where the project justifies it",
    ],
    automations: [
      { trigger: "A portal or website enquiry arrives", outcome: "Instant reply and assignment to a sales owner" },
      { trigger: "A site visit is scheduled", outcome: "Location pin, timing and the executive's contact card" },
      { trigger: "48 hours after a site visit", outcome: "Follow-up with floor plan and payment schedule" },
      { trigger: "A demand note falls due", outcome: "Payment reminder with the breakdown" },
    ],
    systems: [
      { name: "Sales & inventory management", body: "Which units are available, held, booked or sold — in real time.", from: "From ₹49,000" },
      { name: "Collections tracking", body: "Demand notes, receipts and what is overdue by slab.", from: "From ₹24,999" },
      { name: "Sales dashboard", body: "Enquiry sources, site-visit conversion and pipeline value.", from: "From ₹19,000" },
    ],
  },

  veterinary: {
    objective:
      "Make it easy for pet owners to book, and keep vaccination schedules from being forgotten.",
    levels: ["essential", "dynamic"],
    startingFrom: "₹11,999",
    functionality: [
      "Services and consultation information",
      "Appointment booking",
      "Vaccination schedule information",
      "Emergency contact and timings",
      "Pet care articles",
      "Boarding or grooming enquiries",
    ],
    automations: [
      { trigger: "An appointment is booked", outcome: "Confirmation with timing and what to bring" },
      { trigger: "A vaccination is due", outcome: "Reminder to the owner with the pet's name and due date" },
      { trigger: "After a consultation", outcome: "Care instructions and next visit reminder" },
      { trigger: "A boarding stay ends", outcome: "Feedback request and a rebooking offer" },
    ],
    systems: [
      { name: "Pet records & history", body: "Vaccination history, treatments and prescriptions per pet.", from: "From ₹24,999" },
      { name: "Appointment & boarding", body: "Consultations, boarding capacity and grooming slots in one calendar.", from: "From ₹24,999" },
      { name: "Practice dashboard", body: "Consultation volumes, revenue and recall compliance.", from: "From ₹9,999" },
    ],
  },

  agriculture: {
    objective:
      "Reach dealers and farmers who are already searching, in language they actually use.",
    levels: ["essential", "dynamic"],
    startingFrom: "₹11,999",
    functionality: [
      "Product and crop-solution pages",
      "Dealer locator",
      "Usage and dosage guidance",
      "Regional language support",
      "Enquiry forms built for low bandwidth",
      "Downloadable literature",
    ],
    automations: [
      { trigger: "A farmer or dealer enquires", outcome: "Routed to the nearest territory representative" },
      { trigger: "A season or spray window approaches", outcome: "Advisory message to the relevant dealer list" },
      { trigger: "Stock reaches a depot threshold", outcome: "Replenishment alert to the supply team" },
      { trigger: "After a supply", outcome: "Usage guidance and a feedback request" },
    ],
    systems: [
      { name: "Dealer & territory management", body: "Who supplies where, at what rate, with what outstanding.", from: "From ₹49,000" },
      { name: "Stock & depot tracking", body: "Batch and expiry visibility across depots.", from: "From ₹24,999" },
      { name: "Territory dashboard", body: "Sales by region, dealer performance and seasonal trends.", from: "From ₹19,000" },
    ],
  },

  "professional-services": {
    objective:
      "Look as credible online as you are in the room, and stop chasing clients for documents.",
    levels: ["launch-page", "essential", "premium-interactive"],
    startingFrom: "₹6,999",
    functionality: [
      "Service and expertise pages",
      "Team credentials",
      "Case notes and outcomes",
      "Consultation booking",
      "Secure client document upload",
      "Insights or articles",
    ],
    automations: [
      { trigger: "An enquiry arrives", outcome: "Acknowledged immediately with next steps and availability" },
      { trigger: "A statutory due date approaches", outcome: "Owner alerted and the client asked for pending documents" },
      { trigger: "A client uploads documents", outcome: "Acknowledged and assigned to a preparer" },
      { trigger: "An engagement completes", outcome: "Feedback request and a renewal reminder scheduled" },
    ],
    systems: [
      { name: "Engagement & compliance tracking", body: "Every engagement, filing and deadline with an owner.", from: "From ₹49,000" },
      { name: "Client portal", body: "Clients upload documents and check status without emailing you.", from: "From ₹24,999" },
      { name: "Practice dashboard", body: "Billed versus unbilled work, deadlines due and capacity.", from: "From ₹19,000" },
    ],
  },
};

export const playbookFor = (slug: string): IndustryPlaybook | undefined =>
  industryPlaybooks[slug];
