import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, MessageCircle } from "lucide-react";
import { nav, site, whatsappLink } from "@/data/site";
import { Container } from "./primitives";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled ? "border-border bg-background/90 backdrop-blur-md" : "border-transparent bg-background",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5" aria-label={site.name}>
          <span className="grid h-8 w-8 place-items-center rounded-[6px] bg-ink font-display text-sm font-bold text-ink-foreground">
            T
          </span>
          <span className="leading-none">
            <span className="block font-display text-[15px] font-semibold tracking-tight">Tharigopula</span>
            <span className="block font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
              Technologies
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.slice(1).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/portfolio"
            className="rounded-md border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            View Our Work
          </Link>
          <Link
            to="/start-project"
            className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90"
          >
            Start Your Project
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-md border border-border lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {open ? (
        <div className="border-t border-border bg-background lg:hidden">
          <Container className="py-3">
            <nav className="flex flex-col">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="border-b border-border/60 py-3.5 text-[15px] text-foreground last:border-0"
                  activeProps={{ className: "text-signal font-medium" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 grid gap-2 pb-4">
              <Link
                to="/start-project"
                className="rounded-md bg-ink px-4 py-3.5 text-center text-[15px] font-medium text-ink-foreground"
              >
                Start Your Project
              </Link>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-3.5 text-[15px] font-medium"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp Us
              </a>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}

export function WhatsAppFab() {
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed right-4 bottom-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-ink text-ink-foreground shadow-plate transition-transform hover:scale-105 lg:right-6 lg:bottom-6"
    >
      <MessageCircle className="h-5 w-5" />
    </a>
  );
}
