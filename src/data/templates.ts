export type WebsiteCategory = {
  slug: string;
  index: number;
  name: string;
  headline: string;
  suitableFor: string[];
  features: string[];
  priceFrom: string;
  priceRange: string;
  note?: string;
};

export const websiteCategories: WebsiteCategory[] = [
  {
    slug: "launch-page",
    index: 1,
    name: "Launch Page",
    headline: "One premium page that gets a business online properly.",
    suitableFor: ["Campaigns", "New businesses", "Personal brands", "Single-service offers"],
    features: ["Single premium page", "Fully responsive", "Contact form", "WhatsApp", "Basic SEO", "Analytics", "Deployment"],
    priceFrom: "Starting from ₹6,999",
    priceRange: "₹6,999",
    note: "Includes one revision cycle. Ideal when speed matters more than depth.",
  },
  {
    slug: "essential",
    index: 2,
    name: "Essential Business",
    headline: "A clean, fast, credible presence that answers the basic questions.",
    suitableFor: ["Small businesses", "Professionals", "Local services", "Simple company profiles"],
    features: ["Up to 5 core pages", "Fully responsive", "Contact forms", "WhatsApp", "Basic SEO", "Analytics", "Performance optimisation"],
    priceFrom: "Starting from ₹11,999",
    priceRange: "₹11,999 – ₹17,999",
    note: "Common functionality is included, never charged as an extra.",
  },
  {
    slug: "dynamic",
    index: 3,
    name: "Dynamic Business",
    headline: "For businesses whose content, listings and enquiries change regularly.",
    suitableFor: ["Growing SMEs", "Service companies", "Clinics & institutes", "Businesses publishing content"],
    features: ["CMS", "Blog", "Catalogue", "Dynamic services", "Basic database", "Enquiry management", "Booking", "Admin view"],
    priceFrom: "Starting from ₹18,999",
    priceRange: "₹18,999 – ₹34,999",
  },
  {
    slug: "premium-interactive",
    index: 4,
    name: "Premium Interactive",
    headline: "Custom interface design with motion that aids comprehension.",
    suitableFor: ["Established brands", "Product companies", "Premium services", "Design-led businesses"],
    features: ["Custom UI", "Premium interactions", "Scroll animation", "Micro-interactions", "Advanced typography", "Interactive storytelling", "Custom components"],
    priceFrom: "Starting from ₹29,999",
    priceRange: "₹29,999 – ₹54,999",
  },
  {
    slug: "cinematic",
    index: 5,
    name: "Cinematic Experience",
    headline: "A scroll-driven brand story built scene by scene.",
    suitableFor: ["Luxury brands", "Premium real estate", "Hospitality", "Architecture", "Launch campaigns"],
    features: ["Scroll scenes", "Motion-led layouts", "Advanced transitions", "Visual narratives", "Media-rich sections", "Advanced GSAP animation"],
    priceFrom: "Starting from ₹39,999",
    priceRange: "₹39,999 – ₹79,999",
    note: "Custom video production and professional shoots are quoted separately.",
  },
  {
    slug: "immersive-3d",
    index: 6,
    name: "3D Interactive",
    headline: "Used where 3D genuinely explains the product better than photography.",
    suitableFor: ["Product manufacturers", "Machinery & equipment", "Architecture & interiors", "Configurable products"],
    features: ["Interactive 3D scene", "Product rotation", "Hotspots", "3D animation", "Product visualisation", "Scroll-linked 3D", "Configurator-style interaction"],
    priceFrom: "Starting from ₹49,999",
    priceRange: "₹49,999 – ₹1,25,000+",
    note: "Provided or basic 3D assets keep projects toward the lower end. Complex modelling, texturing and simulations are quoted separately.",
  },
];

export type Template = {
  slug: string;
  name: string;
  category: WebsiteCategory["slug"];
  style: string;
  industry: string;
  recommendedFor: string;
  pages: string[];
  features: string[];
  complexity: "Low" | "Medium" | "High" | "Very high";
  priceRange: string;
  timeline: string;
  palette: [string, string, string];
};

export const templates: Template[] = [
  {
    slug: "corporate-professional",
    name: "Corporate Professional",
    category: "essential",
    style: "Corporate",
    industry: "Professional Services",
    recommendedFor: "Consultancies, firms and B2B companies that need credibility fast.",
    pages: ["Home", "About", "Services", "Contact"],
    features: ["Contact form", "WhatsApp", "Basic SEO", "Service pages"],
    complexity: "Low",
    priceRange: "₹11,999 – ₹17,999",
    timeline: "1–2 weeks",
    palette: ["#1c2530", "#e8e6e1", "#c98a3c"],
  },
  {
    slug: "modern-minimal",
    name: "Modern Minimal",
    category: "essential",
    style: "Minimal",
    industry: "Startups",
    recommendedFor: "New businesses that want a sharp, uncluttered first impression.",
    pages: ["Home", "What we do", "Contact"],
    features: ["Single-scroll layout", "Contact form", "WhatsApp", "Fast loading"],
    complexity: "Low",
    priceRange: "₹6,999 – ₹14,999",
    timeline: "1 week",
    palette: ["#111111", "#f6f5f2", "#5b6b5f"],
  },
  {
    slug: "editorial-content",
    name: "Editorial",
    category: "dynamic",
    style: "Editorial",
    industry: "Education",
    recommendedFor: "Businesses publishing articles, updates or knowledge content regularly.",
    pages: ["Home", "Articles", "Article detail", "About", "Contact"],
    features: ["CMS", "Admin panel", "Blog", "Search", "Analytics"],
    complexity: "Medium",
    priceRange: "₹18,999 – ₹32,999",
    timeline: "3–4 weeks",
    palette: ["#20211f", "#faf7f0", "#8a6b3a"],
  },
  {
    slug: "healthcare-clinic",
    name: "Healthcare",
    category: "dynamic",
    style: "Calm clinical",
    industry: "Healthcare & Clinics",
    recommendedFor: "Clinics and practitioners needing appointments and patient information online.",
    pages: ["Home", "Doctors", "Services", "Book appointment", "Contact"],
    features: ["Booking", "Admin panel", "Database", "WhatsApp reminders", "Forms"],
    complexity: "Medium",
    priceRange: "₹22,999 – ₹34,999",
    timeline: "4–6 weeks",
    palette: ["#123b3a", "#f2f7f5", "#3f9e8f"],
  },
  {
    slug: "restaurant-hospitality",
    name: "Restaurant",
    category: "dynamic",
    style: "Warm hospitality",
    industry: "Restaurants & Food",
    recommendedFor: "Restaurants and cafés wanting menu, reservations and customer capture.",
    pages: ["Home", "Menu", "Gallery", "Reserve", "Contact"],
    features: ["Menu CMS", "Reservations", "QR customer capture", "WhatsApp", "Gallery"],
    complexity: "Medium",
    priceRange: "₹18,999 – ₹32,999",
    timeline: "3–5 weeks",
    palette: ["#2a1a12", "#f7efe4", "#c2542e"],
  },
  {
    slug: "industrial-manufacturing",
    name: "Industrial",
    category: "dynamic",
    style: "Technical",
    industry: "Manufacturing",
    recommendedFor: "Manufacturers presenting products, specifications and dealer enquiries.",
    pages: ["Home", "Products", "Product detail", "Applications", "Downloads", "Contact"],
    features: ["Product catalogue", "Spec sheets", "Downloads", "Enquiry routing", "Admin panel"],
    complexity: "Medium",
    priceRange: "₹24,999 – ₹39,999",
    timeline: "4–6 weeks",
    palette: ["#1b1f24", "#eceae5", "#d08a20"],
  },
  {
    slug: "technology-product",
    name: "Technology",
    category: "premium-interactive",
    style: "Product-led",
    industry: "Startups",
    recommendedFor: "SaaS and product companies explaining a system through interaction.",
    pages: ["Home", "Product", "Features", "Pricing", "Docs", "Contact"],
    features: ["Interactive sections", "Micro-interactions", "Scroll storytelling", "Auth", "Analytics"],
    complexity: "High",
    priceRange: "₹29,999 – ₹54,999",
    timeline: "4–6 weeks",
    palette: ["#0f1417", "#eef1f2", "#4d8ee0"],
  },
  {
    slug: "finance-trust",
    name: "Finance",
    category: "premium-interactive",
    style: "Institutional",
    industry: "Finance & Insurance",
    recommendedFor: "Lending, insurance and advisory businesses that must build trust and capture leads.",
    pages: ["Home", "Products", "Calculators", "Resources", "Apply", "Contact"],
    features: ["Financial calculators", "Lead capture", "Document upload", "CRM handoff", "Follow-up automation"],
    complexity: "High",
    priceRange: "₹32,999 – ₹54,999",
    timeline: "4–6 weeks",
    palette: ["#101c2b", "#f0f2f5", "#2f6f5e"],
  },
  {
    slug: "creative-studio",
    name: "Creative",
    category: "premium-interactive",
    style: "Expressive",
    industry: "Creative",
    recommendedFor: "Studios and agencies where the site itself is the portfolio.",
    pages: ["Home", "Work", "Case detail", "Studio", "Contact"],
    features: ["Custom transitions", "Case study layouts", "Media-rich galleries", "CMS"],
    complexity: "High",
    priceRange: "₹29,999 – ₹54,999",
    timeline: "4–6 weeks",
    palette: ["#161616", "#f3ede4", "#e0553b"],
  },
  {
    slug: "luxury-brand",
    name: "Luxury",
    category: "cinematic",
    style: "Luxury",
    industry: "Retail / Hospitality",
    recommendedFor: "Premium brands where presentation is the product.",
    pages: ["Home", "Collection", "Story", "Experience", "Enquire"],
    features: ["Cinematic hero", "Motion storytelling", "Video integration", "Premium typography"],
    complexity: "Very high",
    priceRange: "₹44,999 – ₹79,999",
    timeline: "5–8 weeks",
    palette: ["#0e0d0c", "#efe9df", "#b08d4f"],
  },
  {
    slug: "real-estate-cinematic",
    name: "Real Estate",
    category: "cinematic",
    style: "Architectural",
    industry: "Real Estate",
    recommendedFor: "Premium projects that sell on space, light and location.",
    pages: ["Home", "Project", "Plans", "Location", "Gallery", "Enquire"],
    features: ["Scroll sequences", "Video integration", "Floor plan viewer", "Site-visit enquiry", "Lead routing"],
    complexity: "Very high",
    priceRange: "₹39,999 – ₹74,999",
    timeline: "5–7 weeks",
    palette: ["#14161a", "#eae7e1", "#9a8154"],
  },
  {
    slug: "product-3d",
    name: "3D Interactive",
    category: "immersive-3d",
    style: "Immersive",
    industry: "Manufacturing / Product",
    recommendedFor: "Products that customers need to rotate, open or configure to understand.",
    pages: ["Home", "Explore", "Configurator", "Specifications", "Enquire"],
    features: ["WebGL", "Interactive 3D model", "Scroll-controlled scenes", "Product configurator", "Progressive loading"],
    complexity: "Very high",
    priceRange: "₹49,999 – ₹1,25,000+",
    timeline: "6–9 weeks",
    palette: ["#0b0e12", "#e9edf0", "#3fb0a4"],
  },
];

export const templateBySlug = (slug: string) => templates.find((t) => t.slug === slug);
export const categoryBySlug = (slug: string) => websiteCategories.find((c) => c.slug === slug);

/**
 * The single capability that most defines each direction — shown on the card
 * face so a visitor scanning the gallery knows what they are actually getting.
 */
export const keyCapability: Record<string, string> = {
  "corporate-professional": "Credibility-first service pages",
  "modern-minimal": "Single-scroll, very fast",
  "editorial-content": "Publish articles yourself",
  "healthcare-clinic": "Appointment booking",
  "restaurant-hospitality": "Menu CMS + reservations",
  "industrial-manufacturing": "Product catalogue with specs",
  "technology-product": "Interactive product storytelling",
  "finance-trust": "Live financial calculators",
  "creative-studio": "Custom page transitions",
  "luxury-brand": "Cinematic scroll narrative",
  "real-estate-cinematic": "Scroll-linked project story",
  "product-3d": "Interactive 3D configurator",
};

/** Each category maps to the live demo route that best represents it. */
const categoryDemoPaths: Record<string, string> = {
  "launch-page": "/demo/essential",
  essential: "/demo/essential",
  dynamic: "/demo/dynamic",
  "premium-interactive": "/demo/interactive",
  cinematic: "/demo/cinematic",
  "immersive-3d": "/demo/3d",
};

/** Always resolves to a real demo route; Essential is the safe default. */
export const demoPathFor = (categorySlug: string): string =>
  categoryDemoPaths[categorySlug] ?? "/demo/essential";

/** Cinematic and 3D demos are heavy — they load only when asked for. */
const heavySlugs = new Set(["cinematic", "immersive-3d"]);
export const isHeavyCategory = (categorySlug: string): boolean => heavySlugs.has(categorySlug);
