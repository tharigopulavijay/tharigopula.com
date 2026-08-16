import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({
  children,
  className,
  ink,
  id,
}: {
  children: ReactNode;
  className?: string | undefined;
  ink?: boolean | undefined;
  id?: string | undefined;
}) {
  return (
    <section id={id} className={cn("py-16 sm:py-24", ink && "surface-ink", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, ink }: { children: ReactNode; ink?: boolean | undefined }) {
  return (
    <p className={cn("eyebrow flex items-center gap-2", ink && "text-ink-muted")}>
      <span className="inline-block h-px w-6 bg-signal" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  ink,
  as = "h2",
  className,
}: {
  eyebrow?: string | undefined;
  title: ReactNode;
  lead?: ReactNode | undefined;
  ink?: boolean | undefined;
  as?: "h1" | "h2" | undefined;
  className?: string | undefined;
}) {
  const Tag = as;
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow ? <Eyebrow ink={ink}>{eyebrow}</Eyebrow> : null}
      <Tag
        className={cn(
          "mt-4 text-3xl leading-[1.08] font-semibold sm:text-4xl lg:text-5xl",
          ink ? "text-ink-foreground" : "text-foreground",
        )}
      >
        {title}
      </Tag>
      {lead ? (
        <p className={cn("mt-4 text-base leading-relaxed sm:text-lg", ink ? "text-ink-muted" : "text-muted-foreground")}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

export function Pill({ children, ink }: { children: ReactNode; ink?: boolean | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        ink ? "border-ink-border text-ink-muted" : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function ArrowLink({
  to,
  params,
  children,
  className,
}: {
  to: string;
  params?: Record<string, string> | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      params={params as never}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:text-signal",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
