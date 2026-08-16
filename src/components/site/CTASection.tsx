import { Link } from "@tanstack/react-router";
import { whatsappLink } from "@/data/site";
import { Container } from "./primitives";

export function CTASection({
  title = "Tell us what should work better in your business.",
  body = "Describe the problem in plain language. We will tell you whether technology is the right answer, and what it would realistically take.",
  primary = { to: "/start-project", label: "Estimate My Project" },
  secondary = { to: "/contact", label: "Discuss My Requirement" },
}: {
  title?: string | undefined;
  body?: string | undefined;
  primary?: { to: string; label: string } | undefined;
  secondary?: { to: string; label: string } | undefined;
}) {
  return (
    <section className="surface-ink">
      <Container className="py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl leading-tight font-semibold text-ink-foreground sm:text-4xl">{title}</h2>
          <p className="mt-4 text-base text-ink-muted">{body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={primary.to as any}
              className="rounded-md bg-signal px-5 py-3.5 text-center text-sm font-semibold text-signal-foreground transition-opacity hover:opacity-90"
            >
              {primary.label}
            </Link>
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={secondary.to as any}
              className="rounded-md border border-ink-border px-5 py-3.5 text-center text-sm font-semibold text-ink-foreground transition-colors hover:bg-white/5"
            >
              {secondary.label}
            </Link>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-5 py-3.5 text-center text-sm font-semibold text-ink-muted transition-colors hover:text-signal"
            >
              WhatsApp Us
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
