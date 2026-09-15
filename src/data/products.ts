import type { ProjectStatus } from "./project-status";

/**
 * Tharigopula's own products.
 *
 * Distinct from the portfolio and from the showcase, and the distinction is
 * worth holding: the showcase demonstrates what we can build for you, the
 * portfolio is work we have done, and these are named systems we own and keep
 * developing. A buyer treats "we could build you a clinic system" and "we have
 * a clinic system" as completely different sentences.
 *
 * Every entry carries a status from the shared vocabulary, because the set
 * spans everything from live to not-yet-started and flattening that into one
 * confident grid would be the exact overclaim the portfolio was fixed to avoid.
 */

export type Product = {
  slug: string;
  /** Product name as it should be spoken. */
  name: string;
  /** Who this is for, in their words. */
  audience: string;
  /** One sentence on what it changes for them. */
  promise: string;
  /** The problem it exists to solve, two or three sentences. */
  body: string;
  /** The modules that make it real. Concrete nouns, not benefits. */
  modules: string[];
  status: ProjectStatus;
  /** Colour used for the icon tint and accents. */
  accent: string;
  /** Internal route to a working demo, when one exists. */
  demoTo?: string | undefined;
  /** External site, when the product has its own. */
  externalUrl?: string | undefined;
  /** Shown under the status chip when the plain status needs a qualifier. */
  note?: string | undefined;
};

export const products: Product[] = [
  {
    slug: "clinical",
    name: "Clinical Management System",
    audience: "Clinics, consulting doctors and small hospitals",
    promise: "Everything from the appointment to the follow-up, in one place.",
    body: "Most clinics run on a register, a phone and somebody's memory. Patients get booked twice, case histories live in a cupboard, and nobody knows who was due back last week. This puts the whole visit — booking, consultation, prescription, billing, follow-up — into one record per patient.",
    modules: [
      "Appointments and doctor schedules",
      "Patient records and case history",
      "Prescriptions",
      "Billing and receipts",
      "Follow-up reminders",
      "Reports for the practice",
    ],
    status: "internal-product",
    accent: "#0EA36B",
  },
  {
    slug: "educational",
    name: "Educational Management System",
    audience: "Schools, colleges and coaching institutes",
    promise: "One system for students, staff, fees and the parents asking questions.",
    body: "Schools carry an enormous amount of coordination — attendance, fees, marks, transport, and a constant stream of parent queries. Most of it is handled by staff re-entering the same information into different registers. This holds it once and lets everyone see the part that concerns them.",
    modules: [
      "Student records and admissions",
      "Attendance",
      "Fee collection and dues",
      "Examinations and marks",
      "Staff and timetable",
      "Parent communication",
    ],
    status: "in-build",
    accent: "#2563EB",
  },
  {
    slug: "industrial",
    name: "Industrial Management System",
    audience: "Manufacturers, fabricators and equipment makers",
    promise: "Enquiry to delivery to service, without losing anything in between.",
    body: "A manufacturing business has more moving parts than any software it usually owns — leads, quotations, raw material, production, dispatch, warranty and service visits. This connects them, so raising an invoice moves stock, and a warranty coming due raises itself as a task before the customer calls.",
    modules: [
      "Leads and quotations",
      "Customers and order history",
      "Materials, stock and purchase",
      "Products and bills of material",
      "Service job cards and warranty",
      "Dashboards by role",
    ],
    status: "client-prototype",
    accent: "#7C4DDA",
    demoTo: "/showcase/business-software",
    note: "A full working version is on this site — open it and use it.",
  },
  {
    slug: "hotel",
    name: "Hotel Management System",
    audience: "Hotels, resorts and service apartments",
    promise: "Rooms, bookings, guests and billing on one screen.",
    body: "Front desk, housekeeping and accounts usually run on three different systems that disagree with each other. This is being built so the room status a guest sees, the one housekeeping works from, and the one the bill is raised against are the same number.",
    modules: [
      "Room inventory and rates",
      "Bookings and check-in",
      "Housekeeping status",
      "Guest profiles",
      "Billing and settlement",
      "Occupancy reporting",
    ],
    status: "in-build",
    accent: "#E08411",
  },
  {
    slug: "znuffi",
    name: "Znuffi",
    audience: "Veterinary doctors and pet owners",
    promise: "Pet care coordinated between the clinic and the people who bring the pet in.",
    body: "Veterinary practice is split awkwardly between the doctor's records and what an owner remembers. Znuffi holds both sides — the clinic's appointments and case notes, and the owner's view of their own animal's vaccinations, visits and what is due next.",
    modules: [
      "Doctor profiles and availability",
      "Appointment booking",
      "Pet records and case history",
      "Vaccination schedules",
      "Owner accounts",
      "Reminders",
    ],
    status: "internal-product",
    accent: "#0E8F9E",
    externalUrl: "https://znuffi.com",
    note: "A separate venture, built in partnership. Parts of it are live.",
  },
];

export const productBySlug = (slug: string) => products.find((p) => p.slug === slug);
