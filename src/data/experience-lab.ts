export type ExperienceLevel = {
  slug: string;
  index: string;
  name: string;
  price: string;
  headline: string;
  oneLiner: string;
  whoFor: string[];
  includes: string[];
  businessImpact: string;
  techniques: string[];
  timeline: string;
  demoPath: string;
  heavy: boolean;
  note?: string;
};

export const experienceLevels: ExperienceLevel[] = [
  {
    slug: "essential",
    index: "01",
    name: "Essential",
    price: "₹11,999 – ₹17,999",
    headline: "A clear, credible presence that loads fast anywhere.",
    oneLiner: "Everything a business needs to be found, understood and contacted — nothing it does not.",
    whoFor: ["New businesses", "Local services", "Consultants and clinics", "Single-service companies"],
    includes: [
      "Up to five core pages",
      "Responsive on every device",
      "Contact form and WhatsApp",
      "Basic SEO and analytics",
      "Performance optimisation",
      "Deployment and handover",
    ],
    businessImpact:
      "Turns search traffic and referrals into enquiries. Customers stop asking basic questions because the site already answers them.",
    techniques: ["Semantic HTML", "System typography", "Static rendering", "Accessible forms"],
    timeline: "1 – 2 weeks",
    demoPath: "/demo/essential",
    heavy: false,
  },
  {
    slug: "dynamic",
    index: "02",
    name: "Dynamic",
    price: "₹18,999 – ₹34,999",
    headline: "A website that holds data and does work.",
    oneLiner: "Content you can edit, catalogues customers can search, and enquiries that land somewhere structured.",
    whoFor: ["Retailers and dealers", "Real estate and hospitality", "Education and healthcare", "Growing service firms"],
    includes: [
      "Everything in Essential",
      "Content management",
      "Blog and articles",
      "Searchable catalogue",
      "Booking and enquiry management",
      "Simple admin view",
    ],
    businessImpact:
      "Your team updates content without calling anyone, and every enquiry is captured in one place instead of three inboxes.",
    techniques: ["Database-backed content", "Filtering and search", "Form pipelines", "Admin surfaces"],
    timeline: "2 – 4 weeks",
    demoPath: "/demo/dynamic",
    heavy: false,
  },
  {
    slug: "interactive",
    index: "03",
    name: "Interactive",
    price: "₹29,999 – ₹54,999",
    headline: "Design that responds to the person using it.",
    oneLiner: "Motion with a purpose: attention guided, quality signalled, complexity made easy to explore.",
    whoFor: ["Premium brands", "Design-led studios", "Technology companies", "High-consideration purchases"],
    includes: [
      "Everything in Dynamic",
      "Custom interface design",
      "Scroll-triggered reveals",
      "Micro-interactions",
      "Interactive explainers",
      "Advanced typography system",
    ],
    businessImpact:
      "Raises perceived value before a single conversation. Buyers spend longer on the page and arrive better informed.",
    techniques: ["Pointer-reactive layers", "Magnetic controls", "Scroll observers", "3D card transforms"],
    timeline: "3 – 5 weeks",
    demoPath: "/demo/interactive",
    heavy: false,
  },
  {
    slug: "cinematic",
    index: "04",
    name: "Cinematic",
    price: "₹39,999 – ₹79,999",
    headline: "A scroll-driven story, authored scene by scene.",
    oneLiner: "The page becomes a sequence — pinned scenes, masked reveals and layered depth that carry a narrative.",
    whoFor: ["Launches and campaigns", "Architecture and property", "Luxury and lifestyle", "Brand storytelling"],
    includes: [
      "Everything in Interactive",
      "Scroll-linked scenes",
      "Motion-led layouts",
      "Advanced transitions",
      "Media-rich composition",
      "Narrative art direction",
    ],
    businessImpact:
      "Makes an argument the way a film does. Ideal when the product needs to be felt before it can be priced.",
    techniques: ["GSAP ScrollTrigger", "Pinned timelines", "Clip-path masking", "Parallax depth"],
    timeline: "4 – 7 weeks",
    demoPath: "/demo/cinematic",
    heavy: true,
    note: "Custom video production and professional shoots are quoted separately.",
  },
  {
    slug: "3d",
    index: "05",
    name: "3D Immersive",
    price: "₹49,999 – ₹1,25,000+",
    headline: "A real 3D scene your customer can move through.",
    oneLiner: "Rotate it, inspect it, configure it — the product explains itself without a showroom visit.",
    whoFor: ["Manufacturers", "Property developers", "Product companies", "Configurable offerings"],
    includes: [
      "Everything in Cinematic",
      "Interactive 3D scene",
      "Orbit and inspection controls",
      "Labelled hotspots",
      "Material and finish switching",
      "Scroll-linked 3D moments",
    ],
    businessImpact:
      "Removes the biggest objection in a considered purchase: not being able to see the thing properly.",
    techniques: ["WebGL / three.js", "React Three Fiber", "Adaptive quality", "Lazy scene loading"],
    timeline: "5 – 9 weeks",
    demoPath: "/demo/3d",
    heavy: true,
    note: "Complex custom modelling, texturing and simulations are quoted separately.",
  },
];

export type MatrixRow = { capability: string; values: [string, string, string, string, string] };

export const comparisonMatrix: MatrixRow[] = [
  { capability: "Responsive design", values: ["Yes", "Yes", "Yes", "Yes", "Yes"] },
  { capability: "Contact + WhatsApp", values: ["Yes", "Yes", "Yes", "Yes", "Yes"] },
  { capability: "SEO + analytics", values: ["Basic", "Structured", "Structured", "Advanced", "Advanced"] },
  { capability: "Content management", values: ["—", "Yes", "Yes", "Yes", "Yes"] },
  { capability: "Search + filtering", values: ["—", "Yes", "Yes", "Yes", "Yes"] },
  { capability: "Booking / enquiry desk", values: ["—", "Yes", "Yes", "Yes", "Yes"] },
  { capability: "Custom interface design", values: ["—", "Partial", "Yes", "Yes", "Yes"] },
  { capability: "Micro-interactions", values: ["—", "—", "Yes", "Yes", "Yes"] },
  { capability: "Scroll-driven scenes", values: ["—", "—", "Partial", "Yes", "Yes"] },
  { capability: "Narrative art direction", values: ["—", "—", "—", "Yes", "Yes"] },
  { capability: "Interactive 3D", values: ["—", "—", "—", "—", "Yes"] },
  { capability: "Typical timeline", values: ["1–2 wks", "2–4 wks", "3–5 wks", "4–7 wks", "5–9 wks"] },
  { capability: "Starting from", values: ["₹11,999", "₹18,999", "₹29,999", "₹39,999", "₹49,999"] },
];

export type GuideQuestion = {
  id: string;
  question: string;
  options: { label: string; weights: number[] }[];
};

export const guideQuestions: GuideQuestion[] = [
  {
    id: "goal",
    question: "What does the website mainly need to do?",
    options: [
      { label: "Be found and get us contacted", weights: [3, 1, 0, 0, 0] },
      { label: "Hold content, listings and enquiries", weights: [0, 3, 1, 0, 0] },
      { label: "Make us look clearly premium", weights: [0, 0, 3, 2, 1] },
      { label: "Show a product people must see to believe", weights: [0, 0, 0, 2, 3] },
    ],
  },
  {
    id: "decision",
    question: "How do customers decide to buy from you?",
    options: [
      { label: "Quickly, mostly on trust and price", weights: [3, 2, 0, 0, 0] },
      { label: "After comparing options and details", weights: [0, 3, 2, 0, 0] },
      { label: "Emotionally — it has to feel right", weights: [0, 0, 2, 3, 1] },
      { label: "After inspecting or configuring it", weights: [0, 0, 0, 1, 3] },
    ],
  },
  {
    id: "content",
    question: "How often does the content change?",
    options: [
      { label: "Rarely — it is mostly fixed", weights: [3, 1, 1, 1, 1] },
      { label: "Weekly — offers, posts, listings", weights: [0, 3, 2, 1, 1] },
      { label: "Campaign by campaign", weights: [0, 1, 2, 3, 2] },
      { label: "Product range keeps expanding", weights: [0, 2, 1, 1, 3] },
    ],
  },
];
