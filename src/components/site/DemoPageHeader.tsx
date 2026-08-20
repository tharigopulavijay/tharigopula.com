import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Container } from "./primitives";

/**
 * The shared top of every Showcase child page.
 *
 * All four pages open the same way — breadcrumb, split heading, lead, two
 * actions, three assurances, visual on the right. Writing that four times over
 * is how the four pages drift apart, so it lives here once and each page
 * supplies only what differs.
 */
export function DemoPageHeader({
  crumb,
  title,
  accentTitle,
  lead,
  primary,
  secondary,
  assurances,
  visual,
  visualWide,
}: {
  crumb: string;
  title: ReactNode;
  /** The coloured second line of the heading. */
  accentTitle: string;
  lead: string;
  primary: { to: string; label: string; hash?: string | undefined };
  secondary?: { to: string; label: string } | undefined;
  assurances: string[];
  visual: ReactNode;
  /** Give the visual the larger share of the split — for wide compositions. */
  visualWide?: boolean | undefined;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
      <Container className="relative py-10 sm:py-12 lg:py-14">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span aria-hidden className="px-2">
            ›
          </span>
          <Link to="/showcase" className="hover:text-foreground">
            Showcase
          </Link>
          <span aria-hidden className="px-2">
            ›
          </span>
          <span className="text-signal">{crumb}</span>
        </nav>

        <div
          className={
            visualWide
              ? "grid items-center gap-10 lg:grid-cols-[1fr_1.35fr]"
              : "grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]"
          }
        >
          <div className="reveal min-w-0">
            <h1 className="font-display text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-[3.1rem]">
              {title}
              <br />
              <span className="text-signal">{accentTitle}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {lead}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={primary.hash ?? primary.to}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-6 py-3.5 text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
              >
                {primary.label} <span aria-hidden>→</span>
              </a>
              {secondary ? (
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  to={secondary.to as any}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/25"
                >
                  {secondary.label}
                </Link>
              ) : null}
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5">
              {assurances.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    aria-hidden
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-signal/12 text-signal"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal min-w-0" style={{ animationDelay: "120ms" }}>
            {visual}
          </div>
        </div>
      </Container>
    </section>
  );
}
