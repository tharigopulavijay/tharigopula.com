/**
 * Content for the mobile app demo.
 *
 * Four presets drive one app shell rather than four hand-built apps. The point
 * a visitor needs to take away is that the same foundation is reshaped around
 * their business, so showing one app wearing four different sets of clothes is
 * a more honest demonstration than four unrelated mockups would be.
 *
 * Every business here is fictional and the numbers are illustrative. None of
 * this is presented anywhere as a delivered client project.
 */

export type AppPreset = {
  id: "ordering" | "booking" | "customer" | "business";
  label: string;
  /** One line on the picker chip. */
  note: string;
  brand: string;
  accent: string;
  greeting: string;
  searchHint: string;
  categories: string[];
  /** The main scrollable list on the home screen. */
  items: { name: string; meta: string; price: string; tag?: string }[];
  /** What the second tab lists. */
  listTitle: string;
  orders: {
    ref: string;
    title: string;
    status: "Confirmed" | "In progress" | "Delivered" | "Pending";
    when: string;
    amount: string;
  }[];
  /** Third tab: the numbers this kind of business actually watches. */
  statsTitle: string;
  stats: { label: string; value: string; delta: string }[];
  person: { name: string; sub: string };
};

export const appPresets: AppPreset[] = [
  {
    id: "ordering",
    label: "Ordering app",
    note: "Food, retail and takeaway",
    brand: "Spice Route",
    accent: "#C9313A",
    greeting: "Good evening, Anil",
    searchHint: "Search dishes or restaurants",
    categories: ["Mains", "Starters", "Breads", "Desserts"],
    items: [
      { name: "Appam with stew", meta: "Kerala • 25–30 min", price: "₹340", tag: "Bestseller" },
      { name: "Meen moilee", meta: "Fish curry • 30 min", price: "₹520" },
      { name: "Kallumakkaya fry", meta: "Mussels • 20 min", price: "₹460" },
      { name: "Malabar parotta", meta: "Breads • 15 min", price: "₹90" },
    ],
    listTitle: "Your orders",
    orders: [
      {
        ref: "ORD-1048",
        title: "Appam with stew ×2",
        status: "Delivered",
        when: "Today, 8:40 pm",
        amount: "₹680",
      },
      {
        ref: "ORD-1039",
        title: "Meen moilee, parotta",
        status: "Delivered",
        when: "18 Aug",
        amount: "₹610",
      },
      {
        ref: "ORD-1021",
        title: "Kallumakkaya fry",
        status: "Delivered",
        when: "11 Aug",
        amount: "₹460",
      },
    ],
    statsTitle: "This month",
    stats: [
      { label: "Orders placed", value: "14", delta: "+3" },
      { label: "Total spent", value: "₹7,420", delta: "+18%" },
      { label: "Saved with offers", value: "₹880", delta: "+₹210" },
    ],
    person: { name: "Anil Kumar", sub: "Gold member • 14 orders" },
  },
  {
    id: "booking",
    label: "Booking app",
    note: "Services, clinics and salons",
    brand: "Aarogya Care",
    accent: "#06764B",
    greeting: "Good morning, Priya",
    searchHint: "Search doctors or services",
    categories: ["Consult", "Diagnostics", "Therapy", "Home visit"],
    items: [
      {
        name: "General physician",
        meta: "Dr Rao • Today 4:30 pm",
        price: "₹600",
        tag: "3 slots left",
      },
      { name: "Dermatology", meta: "Dr Menon • Tomorrow", price: "₹900" },
      { name: "Physiotherapy", meta: "8-session package", price: "₹12,000" },
      { name: "Full blood panel", meta: "Home collection", price: "₹1,150" },
    ],
    listTitle: "Your appointments",
    orders: [
      {
        ref: "APT-3312",
        title: "General physician — Dr Rao",
        status: "Confirmed",
        when: "Today, 4:30 pm",
        amount: "₹600",
      },
      {
        ref: "APT-3287",
        title: "Physiotherapy session 3 of 8",
        status: "In progress",
        when: "22 Aug",
        amount: "₹1,500",
      },
      {
        ref: "APT-3240",
        title: "Blood panel — home collection",
        status: "Delivered",
        when: "9 Aug",
        amount: "₹1,150",
      },
    ],
    statsTitle: "Your health record",
    stats: [
      { label: "Visits this year", value: "9", delta: "+2" },
      { label: "Reports on file", value: "16", delta: "+4" },
      { label: "Next review", value: "12 Sep", delta: "23 days" },
    ],
    person: { name: "Priya Sharma", sub: "Patient ID • AAR-20841" },
  },
  {
    id: "customer",
    label: "Customer app",
    note: "Loyalty, wallet and self-service",
    brand: "Vasavi Rewards",
    accent: "#7C4DDA",
    greeting: "Welcome back, Sneha",
    searchHint: "Search products or offers",
    categories: ["Offers", "Wallet", "Warranty", "Support"],
    items: [
      {
        name: "₹2,000 off inverter AC",
        meta: "Expires in 6 days",
        price: "Claim",
        tag: "Unlocked",
      },
      { name: "Extended warranty", meta: '55" QLED television', price: "₹2,499" },
      { name: "Free service visit", meta: "Refrigerator • 1 left", price: "Book" },
      { name: "Refer a friend", meta: "Both get ₹500", price: "Share" },
    ],
    listTitle: "Purchases & requests",
    orders: [
      {
        ref: "INV-8841",
        title: "1.5T inverter split AC",
        status: "Delivered",
        when: "2 Aug",
        amount: "₹42,500",
      },
      {
        ref: "SRV-2210",
        title: "Installation visit",
        status: "Confirmed",
        when: "24 Aug",
        amount: "Free",
      },
      {
        ref: "INV-8702",
        title: "260L refrigerator",
        status: "Delivered",
        when: "14 Jun",
        amount: "₹31,200",
      },
    ],
    statsTitle: "Your account",
    stats: [
      { label: "Reward points", value: "2,450", delta: "+320" },
      { label: "Wallet balance", value: "₹1,180", delta: "+₹500" },
      { label: "Active warranties", value: "3", delta: "1 expiring" },
    ],
    person: { name: "Sneha Reddy", sub: "Member since 2024" },
  },
  {
    id: "business",
    label: "Business app",
    note: "The owner's view, on a phone",
    brand: "Suryan Ops",
    accent: "#2563EB",
    greeting: "Good morning, Ramesh",
    searchHint: "Search orders, stock or customers",
    categories: ["Orders", "Stock", "Team", "Reports"],
    items: [
      { name: "Openwell 5HP", meta: "62 in stock", price: "₹38,400" },
      { name: "Borewell 7.5HP", meta: "34 in stock", price: "₹61,200" },
      { name: "Monoblock 2HP", meta: "9 left — reorder", price: "₹14,800", tag: "Low" },
      { name: "Control panel 3-phase", meta: "155 in stock", price: "₹4,200" },
    ],
    listTitle: "Today's orders",
    orders: [
      {
        ref: "ORD-1048",
        title: "Ramesh Industries",
        status: "Confirmed",
        when: "15m ago",
        amount: "₹2,40,000",
      },
      {
        ref: "ORD-1047",
        title: "Latha Textiles",
        status: "In progress",
        when: "1h ago",
        amount: "₹1,55,000",
      },
      {
        ref: "ORD-1046",
        title: "Sri Sai Enterprises",
        status: "Pending",
        when: "3h ago",
        amount: "₹95,000",
      },
    ],
    statsTitle: "Business today",
    stats: [
      { label: "Revenue", value: "₹8,45,000", delta: "+24%" },
      { label: "Orders", value: "320", delta: "+16%" },
      { label: "Items below reorder", value: "4", delta: "action needed" },
    ],
    person: { name: "Ramesh Kumar", sub: "Owner • Suryan Industries" },
  },
];

export const presetById = (id: AppPreset["id"]) => appPresets.find((p) => p.id === id)!;
