/**
 * Demo Platform — the swappable business layer.
 *
 * One platform UI, six businesses. A visitor picks their industry and every
 * module re-populates with data and vocabulary from their own world: a clinic
 * owner sees patients and appointments, a manufacturer sees dealers and orders.
 *
 * Everything here is fictional but deliberately realistic — amounts, names and
 * ratios are the kind an Indian SME would actually recognise.
 */

export type StageTone = "new" | "active" | "hot" | "won" | "lost";

export type Stage = {
  id: string;
  label: string;
  tone: StageTone;
};

export type Lead = {
  id: string;
  party: string;
  person: string;
  phone: string;
  value: number;
  stage: string;
  source: "Website" | "WhatsApp" | "Referral" | "Walk-in" | "Call" | "Instagram";
  owner: string;
  ageDays: number;
  note: string;
};

export type CatalogItem = {
  sku: string;
  name: string;
  group: string;
  price: number;
  stock: number;
  reorder: number;
  unit: string;
};

export type Txn = {
  id: string;
  party: string;
  summary: string;
  amount: number;
  status: "Paid" | "Pending" | "Overdue" | "Confirmed" | "Draft";
  date: string;
};

export type Job = {
  id: string;
  party: string;
  issue: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "In progress" | "Waiting" | "Closed";
  assignee: string;
  due: string;
};

export type Kpi = {
  label: string;
  value: string;
  delta: number;
  hint: string;
};

export type Automation = {
  trigger: string;
  action: string;
  channel: "WhatsApp" | "Email" | "SMS" | "Internal";
  runs: number;
};

export type Terms = {
  lead: string;
  leads: string;
  customer: string;
  customers: string;
  order: string;
  orders: string;
  item: string;
  items: string;
  stock: string;
  service: string;
};

export type BusinessProfile = {
  slug: string;
  name: string;
  industry: string;
  location: string;
  tagline: string;
  accent: string;
  terms: Terms;
  stages: Stage[];
  leads: Lead[];
  catalog: CatalogItem[];
  txns: Txn[];
  jobs: Job[];
  kpis: Kpi[];
  revenue: { m: string; v: number }[];
  channels: { label: string; v: number }[];
  automations: Automation[];
};

const STAGE_TONES: StageTone[] = ["new", "active", "hot", "won", "lost"];

const stages = (labels: [string, string, string, string, string]): Stage[] =>
  labels.map((label, i) => ({
    id: label.toLowerCase().replace(/[^a-z]+/g, "-"),
    label,
    tone: STAGE_TONES[i]!,
  }));

export const businesses: BusinessProfile[] = [
  /* ------------------------------------------------------------------ */
  {
    slug: "manufacturing",
    name: "Suryan Industries",
    industry: "Manufacturing",
    location: "Coimbatore",
    tagline: "Pumps and motors for agriculture and industry",
    accent: "#F59E0B",
    terms: {
      lead: "Enquiry", leads: "Enquiries",
      customer: "Dealer", customers: "Dealers",
      order: "Order", orders: "Orders",
      item: "Product", items: "Products",
      stock: "Stock", service: "Service calls",
    },
    stages: stages(["New enquiry", "Quotation sent", "Negotiation", "Order confirmed", "Lost"]),
    leads: [
      { id: "E-2841", party: "Annamalai Agencies", person: "R. Selvam", phone: "98940 21134", value: 485000, stage: "new-enquiry", source: "Website", owner: "Priya", ageDays: 1, note: "Wants 12 × 5HP openwell sets for Erode belt." },
      { id: "E-2839", party: "Ganesh Borewells", person: "K. Ganesh", phone: "94430 88210", value: 262000, stage: "new-enquiry", source: "WhatsApp", owner: "Arun", ageDays: 2, note: "Repeat dealer. Asking for revised slab rates." },
      { id: "E-2833", party: "Sri Lakshmi Traders", person: "M. Devi", phone: "90032 47781", value: 748000, stage: "quotation-sent", source: "Referral", owner: "Priya", ageDays: 5, note: "Quotation 2841-A sent. Wants 45-day credit." },
      { id: "E-2827", party: "Kovai Pump House", person: "S. Rajesh", phone: "98421 55093", value: 1145000, stage: "quotation-sent", source: "Call", owner: "Arun", ageDays: 8, note: "Bulk order for new showroom. Needs delivery schedule." },
      { id: "E-2819", party: "Vetri Engineering", person: "P. Vetri", phone: "94867 30012", value: 396000, stage: "negotiation", source: "Referral", owner: "Priya", ageDays: 12, note: "Stuck on freight. Offered ex-works pricing." },
      { id: "E-2812", party: "Amman Motors", person: "T. Bhaskar", phone: "99525 71640", value: 892000, stage: "negotiation", source: "Website", owner: "Arun", ageDays: 15, note: "Comparing with competitor. Sent efficiency test report." },
      { id: "E-2804", party: "Deepam Agro", person: "N. Kumar", phone: "97910 24455", value: 634000, stage: "order-confirmed", source: "WhatsApp", owner: "Priya", ageDays: 19, note: "PO received. Dispatch scheduled for 22nd." },
      { id: "E-2798", party: "Bharath Irrigation", person: "V. Suresh", phone: "93453 66271", value: 218000, stage: "lost", source: "Call", owner: "Arun", ageDays: 26, note: "Went with local assembler on price." },
    ],
    catalog: [
      { sku: "OW-5HP", name: "Openwell submersible 5HP", group: "Openwell", price: 38400, stock: 62, reorder: 25, unit: "unit" },
      { sku: "OW-3HP", name: "Openwell submersible 3HP", group: "Openwell", price: 26900, stock: 18, reorder: 30, unit: "unit" },
      { sku: "BW-7HP", name: "Borewell submersible 7.5HP", group: "Borewell", price: 61200, stock: 34, reorder: 20, unit: "unit" },
      { sku: "MN-2HP", name: "Monoblock 2HP", group: "Monoblock", price: 14800, stock: 9, reorder: 40, unit: "unit" },
      { sku: "CP-100", name: "Control panel 3-phase", group: "Accessories", price: 4200, stock: 155, reorder: 60, unit: "unit" },
      { sku: "CB-90M", name: "Flat cable 90m roll", group: "Accessories", price: 8900, stock: 47, reorder: 25, unit: "roll" },
    ],
    txns: [
      { id: "SO-4471", party: "Deepam Agro", summary: "18 × OW-5HP, 6 × CP-100", amount: 634000, status: "Confirmed", date: "14 Aug" },
      { id: "IN-9903", party: "Kovai Pump House", summary: "Invoice — August dispatch", amount: 1145000, status: "Pending", date: "12 Aug" },
      { id: "IN-9897", party: "Annamalai Agencies", summary: "Invoice — July settlement", amount: 402000, status: "Overdue", date: "28 Jul" },
      { id: "IN-9884", party: "Ganesh Borewells", summary: "Invoice — 9 × BW-7HP", amount: 550800, status: "Paid", date: "21 Jul" },
      { id: "SO-4462", party: "Vetri Engineering", summary: "12 × MN-2HP", amount: 177600, status: "Draft", date: "19 Jul" },
      { id: "IN-9871", party: "Sri Lakshmi Traders", summary: "Invoice — accessories lot", amount: 213400, status: "Paid", date: "09 Jul" },
    ],
    jobs: [
      { id: "SC-712", party: "Amman Motors", issue: "Impeller wear on 3 units under warranty", priority: "High", status: "In progress", assignee: "Murugan", due: "18 Aug" },
      { id: "SC-708", party: "Deepam Agro", issue: "Control panel tripping intermittently", priority: "Medium", status: "Open", assignee: "Unassigned", due: "20 Aug" },
      { id: "SC-703", party: "Kovai Pump House", issue: "On-site training for new showroom staff", priority: "Low", status: "Waiting", assignee: "Priya", due: "26 Aug" },
      { id: "SC-698", party: "Ganesh Borewells", issue: "Replacement cable dispatch", priority: "Medium", status: "Closed", assignee: "Murugan", due: "11 Aug" },
      { id: "SC-691", party: "Vetri Engineering", issue: "Efficiency test report request", priority: "Low", status: "Closed", assignee: "Arun", due: "05 Aug" },
    ],
    kpis: [
      { label: "Open enquiries", value: "27", delta: 12.4, hint: "vs last month" },
      { label: "Pipeline value", value: "₹42.4L", delta: 8.1, hint: "weighted" },
      { label: "Stock alerts", value: "3", delta: -25.0, hint: "below reorder" },
      { label: "Overdue payments", value: "₹4.0L", delta: -18.2, hint: "> 30 days" },
    ],
    revenue: [
      { m: "Jan", v: 2840000 }, { m: "Feb", v: 3120000 }, { m: "Mar", v: 4460000 },
      { m: "Apr", v: 3890000 }, { m: "May", v: 4210000 }, { m: "Jun", v: 5030000 },
      { m: "Jul", v: 4780000 }, { m: "Aug", v: 5620000 },
    ],
    channels: [
      { label: "Dealer network", v: 54 }, { label: "Website", v: 21 },
      { label: "Referral", v: 16 }, { label: "Direct", v: 9 },
    ],
    automations: [
      { trigger: "Website enquiry submitted", action: "Create enquiry + notify sales owner", channel: "WhatsApp", runs: 284 },
      { trigger: "Quotation unopened for 3 days", action: "Send polite follow-up to dealer", channel: "WhatsApp", runs: 96 },
      { trigger: "Stock falls below reorder level", action: "Alert purchase team with shortfall", channel: "Internal", runs: 41 },
      { trigger: "Invoice crosses 30 days", action: "Payment reminder with statement", channel: "Email", runs: 63 },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "healthcare",
    name: "Aarogya Clinic",
    industry: "Healthcare & Clinics",
    location: "Hyderabad",
    tagline: "Multi-speciality day clinic",
    accent: "#10B981",
    terms: {
      lead: "Enquiry", leads: "Enquiries",
      customer: "Patient", customers: "Patients",
      order: "Appointment", orders: "Appointments",
      item: "Treatment", items: "Treatments",
      stock: "Supplies", service: "Follow-ups",
    },
    stages: stages(["New enquiry", "Appointment booked", "Consulted", "Treatment ongoing", "Closed"]),
    leads: [
      { id: "P-1182", party: "Sneha Reddy", person: "Sneha Reddy", phone: "99490 33218", value: 12000, stage: "new-enquiry", source: "Instagram", owner: "Front desk", ageDays: 1, note: "Asking about dermatology consultation and pricing." },
      { id: "P-1180", party: "Mohammed Irfan", person: "Mohammed Irfan", phone: "97045 88123", value: 4500, stage: "new-enquiry", source: "WhatsApp", owner: "Front desk", ageDays: 1, note: "Wants earliest slot for general physician." },
      { id: "P-1176", party: "Lakshmi Prasad", person: "Lakshmi Prasad", phone: "93910 27764", value: 28000, stage: "appointment-booked", source: "Website", owner: "Dr. Rao", ageDays: 3, note: "Booked physiotherapy assessment for Thursday 11:00." },
      { id: "P-1171", party: "Arjun Menon", person: "Arjun Menon", phone: "90003 51192", value: 6500, stage: "appointment-booked", source: "Referral", owner: "Dr. Iyer", ageDays: 4, note: "Follow-up after blood work. Reports uploaded." },
      { id: "P-1164", party: "Fatima Begum", person: "Fatima Begum", phone: "98661 44907", value: 35000, stage: "consulted", source: "Walk-in", owner: "Dr. Rao", ageDays: 7, note: "Advised 6-session physio package. Considering." },
      { id: "P-1158", party: "Venkat Rao", person: "Venkat Rao", phone: "94406 71230", value: 48000, stage: "treatment-ongoing", source: "Referral", owner: "Dr. Iyer", ageDays: 11, note: "Session 3 of 8 complete. Responding well." },
      { id: "P-1149", party: "Divya Sharma", person: "Divya Sharma", phone: "91772 60548", value: 22000, stage: "treatment-ongoing", source: "Website", owner: "Dr. Rao", ageDays: 16, note: "Session 2 of 5. Reschedule requested for next week." },
      { id: "P-1141", party: "Suresh Babu", person: "Suresh Babu", phone: "99598 12036", value: 9000, stage: "closed", source: "Walk-in", owner: "Dr. Iyer", ageDays: 24, note: "Treatment complete. Feedback 5/5." },
    ],
    catalog: [
      { sku: "CON-GP", name: "General physician consultation", group: "Consultation", price: 600, stock: 999, reorder: 0, unit: "slot" },
      { sku: "CON-DRM", name: "Dermatology consultation", group: "Consultation", price: 900, stock: 999, reorder: 0, unit: "slot" },
      { sku: "PHY-PKG", name: "Physiotherapy — 8 session package", group: "Therapy", price: 12000, stock: 999, reorder: 0, unit: "package" },
      { sku: "SUP-GLV", name: "Examination gloves (box of 100)", group: "Supplies", price: 450, stock: 14, reorder: 30, unit: "box" },
      { sku: "SUP-SYR", name: "Disposable syringes (box of 100)", group: "Supplies", price: 680, stock: 8, reorder: 25, unit: "box" },
      { sku: "SUP-BND", name: "Crepe bandage 10cm", group: "Supplies", price: 85, stock: 120, reorder: 50, unit: "unit" },
    ],
    txns: [
      { id: "AP-3312", party: "Lakshmi Prasad", summary: "Physiotherapy assessment", amount: 1200, status: "Confirmed", date: "15 Aug" },
      { id: "BL-7741", party: "Venkat Rao", summary: "Physio package — instalment 2", amount: 6000, status: "Paid", date: "14 Aug" },
      { id: "BL-7738", party: "Fatima Begum", summary: "Consultation + diagnostics", amount: 2800, status: "Pending", date: "13 Aug" },
      { id: "AP-3305", party: "Arjun Menon", summary: "Follow-up consultation", amount: 600, status: "Confirmed", date: "16 Aug" },
      { id: "BL-7729", party: "Divya Sharma", summary: "Physio session 2", amount: 1500, status: "Paid", date: "11 Aug" },
      { id: "BL-7714", party: "Suresh Babu", summary: "Treatment closure invoice", amount: 9000, status: "Paid", date: "04 Aug" },
    ],
    jobs: [
      { id: "FU-208", party: "Venkat Rao", issue: "Session 4 reminder + exercise sheet", priority: "Medium", status: "Open", assignee: "Front desk", due: "18 Aug" },
      { id: "FU-206", party: "Fatima Begum", issue: "Package decision follow-up call", priority: "High", status: "In progress", assignee: "Dr. Rao", due: "17 Aug" },
      { id: "FU-203", party: "Divya Sharma", issue: "Reschedule session 3", priority: "Medium", status: "Waiting", assignee: "Front desk", due: "19 Aug" },
      { id: "FU-199", party: "Arjun Menon", issue: "Share lab reports before visit", priority: "Low", status: "Closed", assignee: "Dr. Iyer", due: "14 Aug" },
      { id: "FU-194", party: "Suresh Babu", issue: "Post-treatment feedback request", priority: "Low", status: "Closed", assignee: "Front desk", due: "06 Aug" },
    ],
    kpis: [
      { label: "Appointments today", value: "34", delta: 9.7, hint: "vs daily average" },
      { label: "Monthly revenue", value: "₹8.4L", delta: 14.2, hint: "vs last month" },
      { label: "No-show rate", value: "6.2%", delta: -31.0, hint: "since reminders" },
      { label: "Supplies low", value: "2", delta: 0, hint: "below reorder" },
    ],
    revenue: [
      { m: "Jan", v: 610000 }, { m: "Feb", v: 648000 }, { m: "Mar", v: 702000 },
      { m: "Apr", v: 689000 }, { m: "May", v: 745000 }, { m: "Jun", v: 781000 },
      { m: "Jul", v: 736000 }, { m: "Aug", v: 840000 },
    ],
    channels: [
      { label: "Walk-in", v: 38 }, { label: "WhatsApp", v: 27 },
      { label: "Referral", v: 22 }, { label: "Instagram", v: 13 },
    ],
    automations: [
      { trigger: "Appointment booked", action: "Confirmation with date, time and location", channel: "WhatsApp", runs: 1240 },
      { trigger: "24 hours before appointment", action: "Reminder with reschedule link", channel: "WhatsApp", runs: 1188 },
      { trigger: "Treatment session completed", action: "Next session reminder + care sheet", channel: "WhatsApp", runs: 512 },
      { trigger: "Treatment closed", action: "Feedback request and review link", channel: "SMS", runs: 274 },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "retail",
    name: "Vasavi Traders",
    industry: "Retail",
    location: "Vijayawada",
    tagline: "Home appliances and electronics",
    accent: "#3B82F6",
    terms: {
      lead: "Walk-in", leads: "Walk-ins",
      customer: "Customer", customers: "Customers",
      order: "Invoice", orders: "Invoices",
      item: "Product", items: "Products",
      stock: "Stock", service: "Warranty claims",
    },
    stages: stages(["New walk-in", "Demo given", "Quotation", "Sold", "Dropped"]),
    leads: [
      { id: "W-5521", party: "Ravi Teja", person: "Ravi Teja", phone: "98480 22617", value: 62000, stage: "new-walk-in", source: "Walk-in", owner: "Kiran", ageDays: 1, note: "Looking at 55-inch smart TVs. Budget around ₹60k." },
      { id: "W-5519", party: "Padma Nair", person: "Padma Nair", phone: "90140 77302", value: 34000, stage: "new-walk-in", source: "Instagram", owner: "Sowmya", ageDays: 1, note: "Enquired about washing machine offers from reel." },
      { id: "W-5512", party: "Anand Kumar", person: "Anand Kumar", phone: "99632 15588", value: 118000, stage: "demo-given", source: "Referral", owner: "Kiran", ageDays: 3, note: "Demo of 1.5T inverter AC × 2. Comparing brands." },
      { id: "W-5506", party: "Hotel Sitara", person: "Purchasing dept", phone: "86887 40021", value: 385000, stage: "quotation", source: "Call", owner: "Sowmya", ageDays: 6, note: "Bulk: 14 ACs for room refurbishment. Quotation sent." },
      { id: "W-5498", party: "Geetha Rani", person: "Geetha Rani", phone: "94904 63317", value: 47000, stage: "quotation", source: "Walk-in", owner: "Kiran", ageDays: 8, note: "Refrigerator + stabiliser. Wants EMI options." },
      { id: "W-5487", party: "Srinivas Rao", person: "Srinivas Rao", phone: "97018 29940", value: 89000, stage: "sold", source: "Website", owner: "Sowmya", ageDays: 12, note: "Delivered and installed. Warranty registered." },
      { id: "W-5479", party: "Naveen Chandra", person: "Naveen Chandra", phone: "93470 51126", value: 28000, stage: "sold", source: "WhatsApp", owner: "Kiran", ageDays: 15, note: "Microwave + mixer. Repeat customer." },
      { id: "W-5468", party: "Kavitha Devi", person: "Kavitha Devi", phone: "91821 07753", value: 71000, stage: "dropped", source: "Walk-in", owner: "Sowmya", ageDays: 22, note: "Found lower online price. Offered match, declined." },
    ],
    catalog: [
      { sku: "TV-55Q", name: "55\" QLED smart television", group: "Television", price: 58900, stock: 11, reorder: 6, unit: "unit" },
      { sku: "AC-15I", name: "1.5T inverter split AC", group: "Cooling", price: 42500, stock: 4, reorder: 10, unit: "unit" },
      { sku: "RF-260", name: "260L double-door refrigerator", group: "Refrigeration", price: 31200, stock: 17, reorder: 8, unit: "unit" },
      { sku: "WM-70F", name: "7kg front-load washing machine", group: "Laundry", price: 33800, stock: 6, reorder: 8, unit: "unit" },
      { sku: "MW-28C", name: "28L convection microwave", group: "Kitchen", price: 12400, stock: 23, reorder: 10, unit: "unit" },
      { sku: "ST-5KV", name: "5KVA voltage stabiliser", group: "Accessories", price: 3900, stock: 58, reorder: 25, unit: "unit" },
    ],
    txns: [
      { id: "INV-8841", party: "Srinivas Rao", summary: "RF-260 + ST-5KV, installed", amount: 89000, status: "Paid", date: "15 Aug" },
      { id: "QT-2210", party: "Hotel Sitara", summary: "Quotation — 14 × AC-15I", amount: 385000, status: "Pending", date: "13 Aug" },
      { id: "INV-8836", party: "Naveen Chandra", summary: "MW-28C + mixer grinder", amount: 28000, status: "Paid", date: "12 Aug" },
      { id: "INV-8829", party: "Lalitha Stores", summary: "Trade sale — 6 × ST-5KV", amount: 23400, status: "Overdue", date: "26 Jul" },
      { id: "INV-8822", party: "Ramesh Babu", summary: "TV-55Q with wall mount", amount: 61400, status: "Paid", date: "22 Jul" },
      { id: "QT-2198", party: "Geetha Rani", summary: "Quotation — fridge + stabiliser", amount: 47000, status: "Draft", date: "09 Aug" },
    ],
    jobs: [
      { id: "WC-441", party: "Ramesh Babu", issue: "TV panel flicker — within warranty", priority: "High", status: "In progress", assignee: "Service desk", due: "17 Aug" },
      { id: "WC-438", party: "Srinivas Rao", issue: "Installation follow-up check", priority: "Low", status: "Open", assignee: "Kiran", due: "20 Aug" },
      { id: "WC-433", party: "Hotel Sitara", issue: "AMC quotation for existing units", priority: "Medium", status: "Waiting", assignee: "Sowmya", due: "21 Aug" },
      { id: "WC-427", party: "Naveen Chandra", issue: "Microwave demo at home", priority: "Low", status: "Closed", assignee: "Service desk", due: "13 Aug" },
      { id: "WC-419", party: "Padma Nair", issue: "Washing machine drum noise", priority: "Medium", status: "Closed", assignee: "Service desk", due: "07 Aug" },
    ],
    kpis: [
      { label: "Today's sales", value: "₹1.4L", delta: 6.8, hint: "vs daily average" },
      { label: "Open quotations", value: "₹4.3L", delta: 22.5, hint: "awaiting decision" },
      { label: "Stock alerts", value: "2", delta: 100.0, hint: "below reorder" },
      { label: "Warranty open", value: "2", delta: -33.3, hint: "active claims" },
    ],
    revenue: [
      { m: "Jan", v: 1840000 }, { m: "Feb", v: 1620000 }, { m: "Mar", v: 2210000 },
      { m: "Apr", v: 3480000 }, { m: "May", v: 4120000 }, { m: "Jun", v: 2960000 },
      { m: "Jul", v: 2410000 }, { m: "Aug", v: 2780000 },
    ],
    channels: [
      { label: "Walk-in", v: 46 }, { label: "Referral", v: 24 },
      { label: "Instagram", v: 18 }, { label: "Website", v: 12 },
    ],
    automations: [
      { trigger: "Invoice generated", action: "Send bill + warranty card as PDF", channel: "WhatsApp", runs: 1806 },
      { trigger: "Quotation pending 2 days", action: "Nudge with offer validity reminder", channel: "WhatsApp", runs: 342 },
      { trigger: "Stock falls below reorder", action: "Purchase alert with supplier contact", channel: "Internal", runs: 88 },
      { trigger: "11 months after purchase", action: "Warranty expiry + AMC offer", channel: "WhatsApp", runs: 197 },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "restaurants",
    name: "Spice Route Kitchen",
    industry: "Restaurants & Food",
    location: "Bengaluru",
    tagline: "Coastal kitchen and bar",
    accent: "#EF4444",
    terms: {
      lead: "Enquiry", leads: "Enquiries",
      customer: "Guest", customers: "Guests",
      order: "Booking", orders: "Bookings",
      item: "Dish", items: "Menu",
      stock: "Ingredients", service: "Feedback",
    },
    stages: stages(["New enquiry", "Table held", "Confirmed", "Dined", "No-show"]),
    leads: [
      { id: "B-9912", party: "Rohit Malhotra", person: "Rohit Malhotra", phone: "99720 41158", value: 8400, stage: "new-enquiry", source: "Instagram", owner: "Host desk", ageDays: 1, note: "Table for 6, Saturday 8pm. Anniversary." },
      { id: "B-9910", party: "Ananya Ghosh", person: "Ananya Ghosh", phone: "98860 33027", value: 3200, stage: "new-enquiry", source: "WhatsApp", owner: "Host desk", ageDays: 1, note: "Table for 2 tonight. Asked about vegan options." },
      { id: "B-9904", party: "Zephyr Tech", person: "HR team", phone: "80502 66714", value: 48000, stage: "table-held", source: "Referral", owner: "Nandini", ageDays: 2, note: "Team dinner for 28. Holding upper deck." },
      { id: "B-9898", party: "Kabir Shetty", person: "Kabir Shetty", phone: "97417 20983", value: 6800, stage: "table-held", source: "Website", owner: "Host desk", ageDays: 3, note: "Birthday setup requested. Cake coordination pending." },
      { id: "B-9891", party: "Meera Krishnan", person: "Meera Krishnan", phone: "94480 55106", value: 12500, stage: "confirmed", source: "Instagram", owner: "Nandini", ageDays: 4, note: "Confirmed for Friday, 9 guests. Advance received." },
      { id: "B-9883", party: "Daniel Fernandes", person: "Daniel Fernandes", phone: "99019 78442", value: 5600, stage: "dined", source: "Walk-in", owner: "Host desk", ageDays: 6, note: "Dined Saturday. Rated 5/5, mentioned the appam." },
      { id: "B-9876", party: "Sana Qureshi", person: "Sana Qureshi", phone: "91082 14459", value: 9200, stage: "dined", source: "WhatsApp", owner: "Nandini", ageDays: 8, note: "Repeat guest, third visit this quarter." },
      { id: "B-9869", party: "Vikram Joshi", person: "Vikram Joshi", phone: "88848 30761", value: 7400, stage: "no-show", source: "Website", owner: "Host desk", ageDays: 11, note: "Did not arrive. Reminder was delivered and read." },
    ],
    catalog: [
      { sku: "MN-APM", name: "Appam with stew", group: "Mains", price: 340, stock: 999, reorder: 0, unit: "plate" },
      { sku: "MN-MFC", name: "Meen moilee (fish curry)", group: "Mains", price: 520, stock: 999, reorder: 0, unit: "plate" },
      { sku: "ST-KLM", name: "Kallumakkaya fry", group: "Starters", price: 460, stock: 999, reorder: 0, unit: "plate" },
      { sku: "ING-PRW", name: "Prawns — tiger, cleaned", group: "Ingredients", price: 720, stock: 6, reorder: 15, unit: "kg" },
      { sku: "ING-CCM", name: "Coconut milk, first press", group: "Ingredients", price: 180, stock: 12, reorder: 20, unit: "litre" },
      { sku: "ING-KRL", name: "Kerala red rice", group: "Ingredients", price: 95, stock: 68, reorder: 30, unit: "kg" },
    ],
    txns: [
      { id: "BK-6621", party: "Meera Krishnan", summary: "Friday dinner, 9 covers", amount: 12500, status: "Confirmed", date: "16 Aug" },
      { id: "BK-6618", party: "Zephyr Tech", summary: "Corporate dinner, 28 covers", amount: 48000, status: "Pending", date: "19 Aug" },
      { id: "BL-4417", party: "Sana Qureshi", summary: "Table 12 — dinner", amount: 9200, status: "Paid", date: "14 Aug" },
      { id: "BL-4409", party: "Daniel Fernandes", summary: "Table 7 — dinner", amount: 5600, status: "Paid", date: "12 Aug" },
      { id: "BK-6609", party: "Kabir Shetty", summary: "Birthday table, 5 covers", amount: 6800, status: "Draft", date: "18 Aug" },
      { id: "BL-4398", party: "Arjun Pillai", summary: "Table 3 — lunch", amount: 3100, status: "Paid", date: "10 Aug" },
    ],
    jobs: [
      { id: "FB-118", party: "Zephyr Tech", issue: "Confirm menu selection and dietary notes", priority: "High", status: "In progress", assignee: "Nandini", due: "17 Aug" },
      { id: "FB-115", party: "Kabir Shetty", issue: "Coordinate cake and table decoration", priority: "Medium", status: "Open", assignee: "Host desk", due: "18 Aug" },
      { id: "FB-111", party: "Vikram Joshi", issue: "No-show follow-up, offer rebooking", priority: "Low", status: "Waiting", assignee: "Host desk", due: "19 Aug" },
      { id: "FB-106", party: "Daniel Fernandes", issue: "Thank you + review request", priority: "Low", status: "Closed", assignee: "Nandini", due: "13 Aug" },
      { id: "FB-102", party: "Sana Qureshi", issue: "Loyalty offer for repeat guest", priority: "Low", status: "Closed", assignee: "Nandini", due: "15 Aug" },
    ],
    kpis: [
      { label: "Covers tonight", value: "86", delta: 11.3, hint: "vs same weekday" },
      { label: "Average bill", value: "₹1,840", delta: 4.6, hint: "per table" },
      { label: "No-show rate", value: "4.1%", delta: -44.0, hint: "since reminders" },
      { label: "Ingredients low", value: "2", delta: 0, hint: "below par level" },
    ],
    revenue: [
      { m: "Jan", v: 1920000 }, { m: "Feb", v: 2140000 }, { m: "Mar", v: 2060000 },
      { m: "Apr", v: 1980000 }, { m: "May", v: 2280000 }, { m: "Jun", v: 2410000 },
      { m: "Jul", v: 2350000 }, { m: "Aug", v: 2620000 },
    ],
    channels: [
      { label: "Instagram", v: 41 }, { label: "Walk-in", v: 29 },
      { label: "WhatsApp", v: 19 }, { label: "Website", v: 11 },
    ],
    automations: [
      { trigger: "Booking confirmed", action: "Confirmation with map and timing", channel: "WhatsApp", runs: 2410 },
      { trigger: "3 hours before booking", action: "Reminder with one-tap cancel", channel: "WhatsApp", runs: 2288 },
      { trigger: "Guest finishes dining", action: "Thank you + Google review link", channel: "WhatsApp", runs: 1904 },
      { trigger: "Ingredient below par level", action: "Kitchen purchase list update", channel: "Internal", runs: 156 },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "real-estate",
    name: "Meridian Estates",
    industry: "Real Estate",
    location: "Hyderabad",
    tagline: "Residential projects and plotted development",
    accent: "#8B5CF6",
    terms: {
      lead: "Enquiry", leads: "Enquiries",
      customer: "Buyer", customers: "Buyers",
      order: "Booking", orders: "Bookings",
      item: "Unit", items: "Inventory",
      stock: "Units", service: "Site visits",
    },
    stages: stages(["New enquiry", "Site visit", "Negotiation", "Booked", "Lost"]),
    leads: [
      { id: "L-7734", party: "Karthik Varma", person: "Karthik Varma", phone: "99590 21847", value: 8200000, stage: "new-enquiry", source: "Website", owner: "Deepak", ageDays: 1, note: "3BHK enquiry from portal. NRI, prefers video walkthrough." },
      { id: "L-7731", party: "Shalini Gupta", person: "Shalini Gupta", phone: "98495 60312", value: 5400000, stage: "new-enquiry", source: "Instagram", owner: "Ritu", ageDays: 2, note: "2BHK budget enquiry. Asked about loan tie-ups." },
      { id: "L-7724", party: "Prakash Rathod", person: "Prakash Rathod", phone: "94901 33075", value: 11500000, stage: "site-visit", source: "Referral", owner: "Deepak", ageDays: 4, note: "Visited Sunday. Liked tower B, east facing." },
      { id: "L-7718", party: "Nithya Balan", person: "Nithya Balan", phone: "90300 78214", value: 7600000, stage: "site-visit", source: "Call", owner: "Ritu", ageDays: 6, note: "Second visit with family scheduled Saturday." },
      { id: "L-7709", party: "Imran Sheikh", person: "Imran Sheikh", phone: "97052 44190", value: 9800000, stage: "negotiation", source: "Website", owner: "Deepak", ageDays: 10, note: "Negotiating on floor rise charges. Close to closing." },
      { id: "L-7698", party: "Sudha Reddy", person: "Sudha Reddy", phone: "93478 15563", value: 6900000, stage: "negotiation", source: "Referral", owner: "Ritu", ageDays: 14, note: "Loan pre-approval in progress with HDFC." },
      { id: "L-7684", party: "Ganesh Iyer", person: "Ganesh Iyer", phone: "99123 90428", value: 10200000, stage: "booked", source: "Referral", owner: "Deepak", ageDays: 21, note: "Booking amount received. Agreement drafting." },
      { id: "L-7671", party: "Rakesh Naidu", person: "Rakesh Naidu", phone: "91777 26039", value: 5800000, stage: "lost", source: "Website", owner: "Ritu", ageDays: 30, note: "Chose competitor project closer to their office." },
    ],
    catalog: [
      { sku: "TA-2B-04", name: "Tower A · 2BHK · 04 series", group: "2BHK", price: 5400000, stock: 6, reorder: 4, unit: "unit" },
      { sku: "TA-3B-02", name: "Tower A · 3BHK · 02 series", group: "3BHK", price: 8200000, stock: 3, reorder: 4, unit: "unit" },
      { sku: "TB-3B-07", name: "Tower B · 3BHK · east facing", group: "3BHK", price: 9100000, stock: 2, reorder: 4, unit: "unit" },
      { sku: "TB-4B-P1", name: "Tower B · 4BHK penthouse", group: "Penthouse", price: 18500000, stock: 1, reorder: 1, unit: "unit" },
      { sku: "PL-N-240", name: "North plots · 240 sq yd", group: "Plots", price: 6200000, stock: 14, reorder: 6, unit: "plot" },
      { sku: "PL-S-300", name: "South plots · 300 sq yd", group: "Plots", price: 7900000, stock: 9, reorder: 6, unit: "plot" },
    ],
    txns: [
      { id: "BK-1182", party: "Ganesh Iyer", summary: "Booking — TB-3B-07", amount: 1020000, status: "Paid", date: "12 Aug" },
      { id: "BK-1179", party: "Imran Sheikh", summary: "Token advance — TA-3B-02", amount: 500000, status: "Pending", date: "15 Aug" },
      { id: "DM-4471", party: "Sudha Reddy", summary: "Demand note — slab 3", amount: 1380000, status: "Pending", date: "14 Aug" },
      { id: "DM-4466", party: "Vijaya Lakshmi", summary: "Demand note — slab 2", amount: 1150000, status: "Overdue", date: "24 Jul" },
      { id: "BK-1171", party: "Anil Kapoor", summary: "Booking — PL-N-240", amount: 620000, status: "Paid", date: "18 Jul" },
      { id: "DM-4458", party: "Ganesh Iyer", summary: "Demand note — on agreement", amount: 2040000, status: "Draft", date: "16 Aug" },
    ],
    jobs: [
      { id: "SV-322", party: "Nithya Balan", issue: "Family site visit — arrange cab and lunch", priority: "High", status: "In progress", assignee: "Ritu", due: "17 Aug" },
      { id: "SV-319", party: "Karthik Varma", issue: "Record video walkthrough for NRI buyer", priority: "High", status: "Open", assignee: "Deepak", due: "18 Aug" },
      { id: "SV-314", party: "Sudha Reddy", issue: "Coordinate bank valuation visit", priority: "Medium", status: "Waiting", assignee: "Ritu", due: "20 Aug" },
      { id: "SV-308", party: "Prakash Rathod", issue: "Share floor plan and payment schedule", priority: "Medium", status: "Closed", assignee: "Deepak", due: "13 Aug" },
      { id: "SV-301", party: "Ganesh Iyer", issue: "Agreement signing appointment", priority: "Low", status: "Closed", assignee: "Deepak", due: "15 Aug" },
    ],
    kpis: [
      { label: "Active enquiries", value: "64", delta: 18.9, hint: "vs last month" },
      { label: "Pipeline value", value: "₹5.5Cr", delta: 12.7, hint: "weighted" },
      { label: "Site visits booked", value: "9", delta: 28.6, hint: "this week" },
      { label: "Collections due", value: "₹25.3L", delta: -8.4, hint: "this month" },
    ],
    revenue: [
      { m: "Jan", v: 18400000 }, { m: "Feb", v: 12600000 }, { m: "Mar", v: 24100000 },
      { m: "Apr", v: 19800000 }, { m: "May", v: 15200000 }, { m: "Jun", v: 28600000 },
      { m: "Jul", v: 22400000 }, { m: "Aug", v: 31200000 },
    ],
    channels: [
      { label: "Property portals", v: 37 }, { label: "Referral", v: 28 },
      { label: "Instagram", v: 21 }, { label: "Walk-in", v: 14 },
    ],
    automations: [
      { trigger: "Portal enquiry received", action: "Instant reply + assign to sales owner", channel: "WhatsApp", runs: 1620 },
      { trigger: "Site visit scheduled", action: "Location pin, timing and contact card", channel: "WhatsApp", runs: 486 },
      { trigger: "48 hours after site visit", action: "Follow-up with floor plan and pricing", channel: "WhatsApp", runs: 412 },
      { trigger: "Demand note due in 7 days", action: "Payment reminder with breakdown", channel: "Email", runs: 238 },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "professional-services",
    name: "Kanaka & Associates",
    industry: "Professional Services",
    location: "Chennai",
    tagline: "Chartered accountants and compliance advisors",
    accent: "#06B6D4",
    terms: {
      lead: "Enquiry", leads: "Enquiries",
      customer: "Client", customers: "Clients",
      order: "Engagement", orders: "Engagements",
      item: "Service", items: "Services",
      stock: "Capacity", service: "Filings",
    },
    stages: stages(["New enquiry", "Proposal sent", "Engaged", "In progress", "Completed"]),
    leads: [
      { id: "EN-482", party: "Nova Textiles", person: "Finance head", phone: "98410 33562", value: 180000, stage: "new-enquiry", source: "Referral", owner: "Sridhar", ageDays: 2, note: "Statutory audit for FY 2025-26. Turnover ₹18Cr." },
      { id: "EN-480", party: "Bright Kids Academy", person: "R. Anitha", phone: "94440 71128", value: 65000, stage: "new-enquiry", source: "Website", owner: "Meena", ageDays: 3, note: "Trust registration and 12A compliance." },
      { id: "EN-476", party: "Corex Logistics", person: "S. Venkatesh", phone: "90031 24907", value: 240000, stage: "proposal-sent", source: "Referral", owner: "Sridhar", ageDays: 6, note: "GST advisory retainer. Proposal sent with 3 options." },
      { id: "EN-471", party: "Anagha Foods", person: "P. Anagha", phone: "97899 60413", value: 96000, stage: "proposal-sent", source: "Call", owner: "Meena", ageDays: 8, note: "Monthly bookkeeping + payroll for 40 staff." },
      { id: "EN-464", party: "Zenith Realty", person: "K. Mohan", phone: "99621 08874", value: 320000, stage: "engaged", source: "Referral", owner: "Sridhar", ageDays: 14, note: "Engagement letter signed. Kickoff scheduled." },
      { id: "EN-457", party: "Sparkle Retail", person: "D. Kavya", phone: "93810 55236", value: 145000, stage: "in-progress", source: "Website", owner: "Meena", ageDays: 22, note: "Q1 filings complete. Q2 data collection ongoing." },
      { id: "EN-448", party: "Pinnacle Exports", person: "T. Ravi", phone: "98846 12770", value: 275000, stage: "in-progress", source: "Referral", owner: "Sridhar", ageDays: 31, note: "Transfer pricing study at draft stage." },
      { id: "EN-441", party: "Harita Motors", person: "L. Harish", phone: "91762 39508", value: 190000, stage: "completed", source: "Referral", owner: "Meena", ageDays: 44, note: "Audit signed off. Renewal due next April." },
    ],
    catalog: [
      { sku: "SV-AUD", name: "Statutory audit", group: "Assurance", price: 180000, stock: 999, reorder: 0, unit: "engagement" },
      { sku: "SV-GST", name: "GST advisory retainer (monthly)", group: "Tax", price: 20000, stock: 999, reorder: 0, unit: "month" },
      { sku: "SV-BKP", name: "Bookkeeping (monthly)", group: "Accounting", price: 8000, stock: 999, reorder: 0, unit: "month" },
      { sku: "SV-PAY", name: "Payroll processing (per 25 staff)", group: "Accounting", price: 6000, stock: 999, reorder: 0, unit: "month" },
      { sku: "SV-ITR", name: "Income tax return — company", group: "Tax", price: 25000, stock: 999, reorder: 0, unit: "filing" },
      { sku: "SV-ROC", name: "ROC annual compliance", group: "Secretarial", price: 18000, stock: 999, reorder: 0, unit: "filing" },
    ],
    txns: [
      { id: "IN-2291", party: "Zenith Realty", summary: "Engagement — advance 40%", amount: 128000, status: "Paid", date: "13 Aug" },
      { id: "IN-2288", party: "Sparkle Retail", summary: "Q1 filings + bookkeeping", amount: 52000, status: "Pending", date: "15 Aug" },
      { id: "IN-2281", party: "Pinnacle Exports", summary: "Transfer pricing — milestone 1", amount: 110000, status: "Pending", date: "11 Aug" },
      { id: "IN-2274", party: "Harita Motors", summary: "Audit — final settlement", amount: 76000, status: "Overdue", date: "22 Jul" },
      { id: "IN-2266", party: "Anagha Foods", summary: "Proposal — retainer draft", amount: 96000, status: "Draft", date: "14 Aug" },
      { id: "IN-2259", party: "Corex Logistics", summary: "GST advisory — July", amount: 20000, status: "Paid", date: "05 Aug" },
    ],
    jobs: [
      { id: "FL-914", party: "Sparkle Retail", issue: "GSTR-3B filing for July", priority: "High", status: "In progress", assignee: "Meena", due: "20 Aug" },
      { id: "FL-911", party: "Corex Logistics", issue: "TDS return Q1 — data pending from client", priority: "High", status: "Waiting", assignee: "Sridhar", due: "18 Aug" },
      { id: "FL-907", party: "Zenith Realty", issue: "Engagement kickoff and document checklist", priority: "Medium", status: "Open", assignee: "Sridhar", due: "19 Aug" },
      { id: "FL-901", party: "Pinnacle Exports", issue: "Draft TP study internal review", priority: "Medium", status: "Closed", assignee: "Sridhar", due: "12 Aug" },
      { id: "FL-894", party: "Harita Motors", issue: "Audit report signing and dispatch", priority: "Low", status: "Closed", assignee: "Meena", due: "04 Aug" },
    ],
    kpis: [
      { label: "Active engagements", value: "38", delta: 5.6, hint: "vs last month" },
      { label: "Billed this month", value: "₹6.2L", delta: 9.8, hint: "vs last month" },
      { label: "Filings due (7 days)", value: "11", delta: 22.2, hint: "statutory" },
      { label: "Unbilled work", value: "₹2.8L", delta: -14.7, hint: "WIP" },
    ],
    revenue: [
      { m: "Jan", v: 520000 }, { m: "Feb", v: 480000 }, { m: "Mar", v: 1240000 },
      { m: "Apr", v: 890000 }, { m: "May", v: 610000 }, { m: "Jun", v: 580000 },
      { m: "Jul", v: 640000 }, { m: "Aug", v: 620000 },
    ],
    channels: [
      { label: "Referral", v: 58 }, { label: "Website", v: 19 },
      { label: "Existing client", v: 15 }, { label: "Direct", v: 8 },
    ],
    automations: [
      { trigger: "Statutory due date in 7 days", action: "Alert owner + request pending documents", channel: "WhatsApp", runs: 684 },
      { trigger: "Client uploads documents", action: "Acknowledge and assign to preparer", channel: "Email", runs: 412 },
      { trigger: "Invoice crosses 21 days", action: "Polite payment reminder with statement", channel: "Email", runs: 148 },
      { trigger: "Engagement completed", action: "Feedback request + renewal reminder set", channel: "Email", runs: 96 },
    ],
  },
];

export const businessBySlug = (slug: string) =>
  businesses.find((b) => b.slug === slug) ?? businesses[0]!;

/* ---------------------------------------------------------------- */
/* Formatting helpers — Indian numbering, used across every module.  */
/* ---------------------------------------------------------------- */

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

/** Compact Indian format: 4250000 -> "₹42.5L", 31200000 -> "₹3.1Cr" */
export function inrShort(n: number): string {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return "₹" + n;
}

export const stageTotal = (b: BusinessProfile, stageId: string) =>
  b.leads.filter((l) => l.stage === stageId).reduce((sum, l) => sum + l.value, 0);

export const lowStock = (b: BusinessProfile) =>
  b.catalog.filter((c) => c.reorder > 0 && c.stock < c.reorder);
