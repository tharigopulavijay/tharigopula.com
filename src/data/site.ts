export const site = {
  name: "Tharigopula Technologies",
  short: "Tharigopula",
  domain: "tharigopula.com",
  url: "https://tharigopula.com",
  positioning: "Technology built around your business.",
  supporting: "Websites. Software. Data. Automation. AI. One technology partner.",
  email: "hello.tharigopula@gmail.com",
  phoneDisplay: "+91 93986 04302",
  whatsapp: "919398604302",
};

export const whatsappLink = (message = "Hello Tharigopula Technologies, I would like to discuss a project.") =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;

export const nav = [
  { to: "/", label: "Home" },
  { to: "/solutions", label: "Solutions" },
  { to: "/industries", label: "Industries" },
  { to: "/website-studio", label: "Website Studio" },
  { to: "/experience-lab", label: "Experience Lab" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;
