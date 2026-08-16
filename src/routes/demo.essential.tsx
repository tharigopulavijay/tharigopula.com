import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { demoBrand, demoServices, demoStats } from "@/data/demo-brand";

export const Route = createFileRoute("/demo/essential")({
  head: () => ({
    meta: [
      { title: "Aurelia Ridge — Hillside Residences (Essential Demo)" },
      {
        name: "description",
        content: "A clean, fast, essential website for Aurelia Ridge, a premium hillside residential development in Bengaluru.",
      },
      { property: "og:title", content: "Aurelia Ridge — Essential Site Demo" },
      {
        property: "og:description",
        content: "Experience 01: a simple, well-built business website for a hillside residential development.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EssentialDemo,
});

const navLinks = [
  { href: "#services", label: "Residences" },
  { href: "#about", label: "About" },
  { href: "#trust", label: "The Ridge" },
  { href: "#contact", label: "Contact" },
];

function whatsappLink() {
  return `https://wa.me/${demoBrand.whatsapp}?text=${encodeURIComponent(
    "Hi, I'd like to know more about Aurelia Ridge.",
  )}`;
}

function EssentialDemo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <Hero />
      <Services />
      <About />
      <Trust />
      <ContactSection />
      <Footer />
      <a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-signal-foreground shadow-lift transition-transform hover:scale-[1.03] motion-reduce:transition-none"
      >
        <span aria-hidden>💬</span> WhatsApp
      </a>
    </div>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="font-display text-lg font-semibold tracking-tight text-ink">
          {demoBrand.name}
        </a>
        <ul className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-foreground">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#contact"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground transition-opacity hover:opacity-90"
        >
          Enquire
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-signal uppercase">{demoBrand.location}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {demoBrand.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">{demoBrand.promise}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="rounded-md bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground transition-opacity hover:opacity-90"
            >
              Schedule a visit
            </a>
            <a
              href="#services"
              className="rounded-md border border-border px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              View residences
            </a>
          </div>
        </div>
        <div className="aspect-[4/3] w-full rounded-2xl border border-border bg-gradient-to-br from-ink to-ink/70 shadow-plate" />
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <SectionHeading eyebrow="Residences" title="Four ways to live on the ridge" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {demoServices.map((s) => (
          <div
            key={s.title}
            className="rounded-xl border border-border bg-card p-6 shadow-lift transition-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="border-y border-border bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center">
        <div className="aspect-[4/3] rounded-2xl border border-border bg-card" />
        <div>
          <SectionHeading eyebrow="About" title={`${demoBrand.developer}`} align="left" />
          <p className="mt-4 text-muted-foreground">
            {demoBrand.developer} builds a small number of considered homes rather than many ordinary ones. Aurelia
            Ridge is our latest: twelve residences set into a working hillside, designed for daylight, cross
            ventilation and long-term durability.
          </p>
          <p className="mt-4 text-muted-foreground">
            Every material choice is made to age well — board-formed concrete, local granite, and a lime render that
            weathers honestly instead of hiding wear.
          </p>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section id="trust" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <SectionHeading eyebrow="The ridge, in numbers" title="Built to last a generation" />
      <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {demoStats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="font-display text-3xl font-semibold text-ink sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContactSection() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const next: Record<string, string> = {};
    if (!name) next["name"] = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(email)) next["email"] = "Enter a valid email";
    if (message.length < 10) next["message"] = "Tell us a little more";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    e.currentTarget.reset();
    toast.success("Thanks — we'll be in touch about Aurelia Ridge shortly.");
  };

  const field =
    "mt-1.5 w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ink/40";

  return (
    <section id="contact" className="border-t border-border bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-signal uppercase">Contact</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Arrange a private viewing
          </h2>
          <p className="mt-4 max-w-md text-ink-foreground/70">
            Speak with our sales team about availability, pricing and the handover schedule for {demoBrand.name}.
          </p>
          <div className="mt-8 space-y-2 text-sm text-ink-foreground/80">
            <p>{demoBrand.location}</p>
            <a href={`mailto:${demoBrand.email}`} className="block hover:underline">
              {demoBrand.email}
            </a>
            <a href={`tel:${demoBrand.phone}`} className="block hover:underline">
              {demoBrand.phone}
            </a>
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          noValidate
          className="rounded-xl border border-ink-border bg-background p-6 text-foreground sm:p-8"
        >
          <label className="block text-sm font-medium">
            Name
            <input name="name" className={field} maxLength={100} />
            {errors["name"] ? <span className="mt-1 block text-xs text-destructive">{errors["name"]}</span> : null}
          </label>
          <label className="mt-4 block text-sm font-medium">
            Email
            <input name="email" type="email" className={field} maxLength={255} />
            {errors["email"] ? <span className="mt-1 block text-xs text-destructive">{errors["email"]}</span> : null}
          </label>
          <label className="mt-4 block text-sm font-medium">
            Message
            <textarea name="message" rows={4} className={field} maxLength={1000} />
            {errors["message"] ? (
              <span className="mt-1 block text-xs text-destructive">{errors["message"]}</span>
            ) : null}
          </label>
          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-signal px-5 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
          >
            Send enquiry
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} {demoBrand.developer}. {demoBrand.name} is a demo site.
        </p>
        <p>{demoBrand.location}</p>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="font-mono text-xs tracking-[0.2em] text-signal uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
    </div>
  );
}
