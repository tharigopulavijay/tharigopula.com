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
        scrolled
          ? "border-border bg-background/90 backdrop-blur-md"
          : "border-transparent bg-background",
      )}
    >
      <Container className="flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={site.name}>
          <img
            src="/logo-mark.png"
            alt=""
            width={96}
            height={96}
            className="h-10 w-10 shrink-0 object-contain"
            aria-hidden="true"
          />
          <span className="leading-none">
            <span className="block font-display text-[15px] font-semibold tracking-tight">
              Tharigopula
            </span>
            <span className="block font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
              Technologies
            </span>
          </span>
        </Link>

        <nav className="mr-auto hidden items-center gap-0.5 xl:ml-5 xl:flex 2xl:ml-7 2xl:gap-1">
          {nav.slice(1).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:px-3"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <Link
            to="/portfolio"
            className="whitespace-nowrap rounded-md border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            View Our Work
          </Link>
          <Link
            to="/start-project"
            className="whitespace-nowrap rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90"
          >
            Start Your Project
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-md border border-border xl:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {open ? (
        <div className="border-t border-border bg-background xl:hidden">
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
