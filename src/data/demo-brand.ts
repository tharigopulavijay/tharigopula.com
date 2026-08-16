/**
 * Shared fictional business used across all five Experience Lab demos.
 * Same business, same content, five levels of digital experience.
 */

export const demoBrand = {
  name: "Aurelia Ridge",
  tagline: "A hillside residential development",
  developer: "Aurelia Developments",
  location: "Sarjapur Ridge, Bengaluru",
  promise: "Twelve residences. One ridge. Built to last a generation.",
  phone: "+91 90000 00000",
  whatsapp: "919000000000",
  email: "sales@aureliaridge.example",
};

export const demoServices = [
  { title: "Ridge Villas", body: "Four-bedroom hillside homes with private courtyards and north light." },
  { title: "Terrace Residences", body: "Three-bedroom homes stepped along the slope, each with a deep terrace." },
  { title: "The Commons", body: "Shared gardens, a lap pool, work pods and a residents' pavilion." },
  { title: "Aftercare", body: "Facility management, warranty support and resale advisory for owners." },
];

export const demoStats = [
  { value: "12", label: "Residences" },
  { value: "4.2", label: "Acres" },
  { value: "82%", label: "Open ground" },
  { value: "2027", label: "Handover" },
];

export const demoUnits = [
  { id: "RV-01", type: "Ridge Villa", beds: 4, area: 3840, facing: "North", price: "₹4.6 Cr", status: "Available" },
  { id: "RV-02", type: "Ridge Villa", beds: 4, area: 3910, facing: "East", price: "₹4.8 Cr", status: "Reserved" },
  { id: "TR-11", type: "Terrace Residence", beds: 3, area: 2450, facing: "North", price: "₹3.1 Cr", status: "Available" },
  { id: "TR-12", type: "Terrace Residence", beds: 3, area: 2510, facing: "West", price: "₹3.2 Cr", status: "Available" },
  { id: "TR-14", type: "Terrace Residence", beds: 3, area: 2380, facing: "East", price: "₹3.0 Cr", status: "Sold" },
  { id: "RV-05", type: "Ridge Villa", beds: 5, area: 4520, facing: "North", price: "₹5.9 Cr", status: "Available" },
];

export const demoArticles = [
  { slug: "site-progress-q3", title: "Site progress: the ridge takes shape", tag: "Construction", date: "12 Aug 2026", excerpt: "Foundations for the first six residences are complete and the retaining walls are curing." },
  { slug: "why-north-light", title: "Why every home faces north light", tag: "Design", date: "28 Jul 2026", excerpt: "A short note on orientation, heat load and why the plan is rotated 14 degrees." },
  { slug: "materials-palette", title: "The materials palette, explained", tag: "Design", date: "02 Jul 2026", excerpt: "Board-formed concrete, local granite and a lime render that ages honestly." },
  { slug: "home-loans", title: "Financing an under-construction home", tag: "Ownership", date: "19 Jun 2026", excerpt: "How disbursement schedules work and what banks look for on a ridge site." },
];
