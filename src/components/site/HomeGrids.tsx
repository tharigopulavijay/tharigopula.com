import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * The repeating card the homepage is built from.
 *
 * One unit — icon, short title, one line, arrow — reused at different grid
 * widths. Keeping it in a single component is what stops six sections of cards
 * drifting into six slightly different card designs.
 *
 * Six across is deliberately only applied from `xl`. At 1400px six cards are
 * about 210px each, which is enough for a two-word label but wraps badly for
 * "Professional Services", so the grid steps down rather than squeezing.
 */

export type GridItem = {
  title: string;
  body: string;
  icon: React.ReactNode;
  /** Internal route. Omit for a non-linking card. */
  to?: string;
  params?: Record<string, string>;
};

export function IconCard({ item, tone = "signal" }: { item: GridItem; tone?: string }) {
  const inner = (
    <>
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-lg transition-colors",
          "bg-secondary text-signal group-hover:bg-signal group-hover:text-signal-foreground",
        )}
        style={tone !== "signal" ? { color: tone } : undefined}
        aria-hidden
      >
        {item.icon}
      </span>
      <span className="mt-4 block font-display text-[15px] leading-snug font-semibold">
        {item.title}
      </span>
      <span className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">
        {item.body}
      </span>
      {item.to ? (
        <span
          aria-hidden
          className="mt-auto pt-4 text-signal transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      ) : null}
    </>
  );

  const className =
    "group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-lift";

  if (!item.to) return <div className={className}>{inner}</div>;

  return (
    <Link to={item.to} {...(item.params ? { params: item.params } : {})} className={className}>
      {inner}
    </Link>
  );
}

export function CardGrid({ items, cols = 6 }: { items: GridItem[]; cols?: 3 | 5 | 6 }) {
  return (
    <div
      className={cn(
        "mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        cols === 6 && "xl:grid-cols-6",
        cols === 5 && "xl:grid-cols-5",
      )}
    >
      {items.map((i) => (
        <IconCard key={i.title} item={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons — one weight, one style, so the grids read as a set.          */
/* ------------------------------------------------------------------ */

function svg(children: React.ReactNode) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const Icons = {
  customers: () =>
    svg(
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M18 8v5M20.5 10.5h-5" />
      </>,
    ),
  operations: () =>
    svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>,
    ),
  automate: () => svg(<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />),
  custom: () => svg(<path d="M8 6 3 12l5 6M16 6l5 6-5 6M13.5 4l-3 16" />),
  reporting: () =>
    svg(
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l3.5-4 3 2.5L20 7" />
      </>,
    ),
  app: () =>
    svg(
      <>
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18.5h2" />
      </>,
    ),
  factory: () =>
    svg(
      <>
        <path d="M3 21V10l5 3V10l5 3V10l5 3v8H3Z" />
        <path d="M7 21v-4M12 21v-4M17 21v-4" />
      </>,
    ),
  clinic: () =>
    svg(
      <>
        <path d="M12 21s-7-4.7-7-10a7 7 0 0 1 14 0c0 5.3-7 10-7 10Z" />
        <path d="M12 7.5v6M9 10.5h6" />
      </>,
    ),
  restaurant: () =>
    svg(
      <>
        <path d="M6 2v8a2.5 2.5 0 0 0 5 0V2M8.5 10v12" />
        <path d="M17 2c-1.5 2-2 4-2 6.5S16 12 17 12v10" />
      </>,
    ),
  retail: () =>
    svg(
      <>
        <path d="M2.5 3h2l2.2 11.5a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 7H6" />
        <circle cx="9.5" cy="20" r="1.2" />
        <circle cx="17.5" cy="20" r="1.2" />
      </>,
    ),
  realEstate: () =>
    svg(
      <>
        <path d="M4 21V6l8-3 8 3v15" />
        <path d="M9 21v-6h6v6M9 10h.01M15 10h.01" />
      </>,
    ),
  professional: () =>
    svg(
      <>
        <rect x="2.5" y="7" width="19" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M2.5 12h19" />
      </>,
    ),
};
