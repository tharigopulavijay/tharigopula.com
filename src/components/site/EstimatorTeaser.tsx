import { Link } from "@tanstack/react-router";
import { priceLabel, systemTiers, websiteTiers } from "@/data/catalog";

/**
 * A one-click entry into the configurator.
 *
 * The homepage previously embedded the whole eight-step estimator, which meant
 * every visitor downloaded the configurator's logic whether or not they ever
 * scrolled to it — and duplicated /start-project entirely.
 *
 * This renders the same first question from catalog data alone, then hands the
 * answer to the real configurator. The visitor still starts in one click, but
 * the heavy step lives on one page instead of two.
 */

export function EstimatorTeaser() {
  const starters = [
    websiteTiers.find((t) => t.id === "essential")!,
    websiteTiers.find((t) => t.id === "dynamic")!,
    websiteTiers.find((t) => t.id === "premium")!,
  ];
  const systems = [
    systemTiers.find((s) => s.id === "crm")!,
    systemTiers.find((s) => s.id === "automation")!,
    systemTiers.find((s) => s.id === "dashboard")!,
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        Start with what you need
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Pick a starting point and the configurator opens with it selected. Eight short questions,
        then an indicative range with the scope written out — no contact details required to see it.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-base font-semibold">A website</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {starters.map((t) => (
              <li key={t.id}>
                <Link
                  to="/start-project"
                  search={{ base: t.id }}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-signal hover:bg-signal/5"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="shrink-0 text-muted-foreground">{priceLabel(t)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-base font-semibold">A system for the business</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {systems.map((s) => (
              <li key={s.id}>
                <Link
                  to="/start-project"
                  search={{ base: s.id }}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-signal hover:bg-signal/5"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground">{priceLabel(s)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <Link
          to="/start-project"
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-signal"
        >
          Not sure yet — walk me through it <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
