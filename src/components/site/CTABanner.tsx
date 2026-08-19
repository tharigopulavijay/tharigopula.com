import { Link } from "@tanstack/react-router";
import { track } from "@/lib/analytics";

/**
 * The closing call to action — the one heavy block of colour on an otherwise
 * light page, so the eye lands on it after scrolling past everything else.
 *
 * Offers a form and a WhatsApp thread side by side on purpose: an SME owner
 * reading this on a phone is far more likely to send a message than fill in
 * eight fields, and losing that lead to a form they will not complete is worse
 * than losing the structured data.
 */
export function CTABanner({
  title,
  body,
  primary,
  whatsapp,
}: {
  title: string;
  body: string;
  primary: { to: string; label: string };
  whatsapp: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink px-6 py-10 sm:px-10 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: "radial-gradient(120% 90% at 85% 15%, rgba(37,99,235,0.35), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col items-start gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="max-w-md font-display text-2xl leading-tight font-semibold text-ink-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2.5 max-w-md text-sm text-ink-muted sm:text-base">{body}</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            to={primary.to}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-transform hover:scale-[1.02]"
          >
            {primary.label} <span aria-hidden>→</span>
          </Link>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track({ name: "whatsapp_clicked", source: "home-cta" })}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-border px-6 py-3.5 text-sm font-semibold text-ink-foreground transition-colors hover:bg-white/5"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.2 1.3-2 1.4-.5.1-1.2.2-3.5-.7-2.9-1.2-4.8-4.2-5-4.4-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.4-.3.4c-.1.1-.2.3 0 .5.2.4.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l2 .9c.2.1.4.2.4.3v.4Z" />
            </svg>
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
