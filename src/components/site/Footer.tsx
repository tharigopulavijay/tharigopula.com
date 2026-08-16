import { Link } from "@tanstack/react-router";
import { site, whatsappLink } from "@/data/site";
import { Container } from "./primitives";

const columns = [
  {
    title: "Explore",
    links: [
      { to: "/solutions", label: "Solutions" },
      { to: "/industries", label: "Industries" },
      { to: "/website-studio", label: "Website Studio" },
      { to: "/portfolio", label: "Portfolio" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/pricing", label: "Pricing" },
      { to: "/about", label: "About" },
      { to: "/start-project", label: "Start Your Project" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="surface-ink">
      <Container className="py-14 sm:py-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="font-display text-lg font-semibold text-ink-foreground">{site.name}</p>
            <p className="mt-2 max-w-xs text-sm text-ink-muted">{site.positioning}</p>
            <p className="mt-6 font-mono text-xs tracking-[0.18em] text-ink-muted uppercase">{site.domain}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-ink-foreground/85 transition-colors hover:text-signal">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-ink-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
            <a href={`mailto:${site.email}`} className="hover:text-signal">
              {site.email}
            </a>
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="hover:text-signal">
              WhatsApp
            </a>
            <a href={`https://${site.domain}`} className="hover:text-signal">
              {site.domain}
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
