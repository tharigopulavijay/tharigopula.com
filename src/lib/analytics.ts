/**
 * The event taxonomy for the site's funnel.
 *
 * Page views alone cannot answer the question that matters — where do people
 * stop? A visitor who opens an industry page, launches the demo, starts the
 * configurator and then leaves at step four is telling you something specific,
 * and none of it shows up in a pageview count.
 *
 * Deliberately provider-agnostic. Nothing is wired to a vendor, so no account,
 * key or cookie banner is required to ship this. Events queue on `window` and
 * are handed to whichever provider is later connected in one place — see
 * `initAnalytics`. Until then `track()` is a safe no-op in production and logs
 * to the console in development.
 *
 * No personal data is ever sent: no names, emails, phone numbers or message
 * bodies. Only which step was reached and which option was chosen.
 */

export type AnalyticsEvent =
  // Discovery
  | { name: "industry_selected"; industry: string }
  | { name: "solution_viewed"; solution: string }
  | { name: "problem_selected"; problem: string }
  // Demonstration
  | { name: "demo_opened"; demo: string; industry?: string }
  | { name: "demo_industry_changed"; from: string; to: string }
  | { name: "demo_module_viewed"; module: string; business: string }
  | { name: "automation_demo_started"; business: string }
  | { name: "experience_level_viewed"; level: string }
  // Consideration
  | { name: "portfolio_opened"; project: string; status: string }
  | { name: "pricing_viewed"; category?: string }
  | { name: "template_previewed"; template: string }
  // Configuration
  | { name: "estimator_started"; source: string; base?: string; industry?: string }
  | { name: "estimator_step_completed"; step: number; field: string }
  | { name: "estimator_completed"; base: string; low: number; high: number; modules: number }
  // Conversion
  | { name: "whatsapp_clicked"; source: string }
  | { name: "phone_clicked"; source: string }
  | { name: "email_clicked"; source: string }
  | { name: "contact_submitted"; source: string; hadEstimate: boolean };

export type AnalyticsEventName = AnalyticsEvent["name"];

/** Ordered funnel stages, so drop-off can be read without guessing. */
export const FUNNEL: AnalyticsEventName[] = [
  "industry_selected",
  "demo_opened",
  "estimator_started",
  "estimator_completed",
  "contact_submitted",
];

type QueuedEvent = AnalyticsEvent & { at: number; path: string };

declare global {
  interface Window {
    __tgAnalytics?: QueuedEvent[];
    /** Set by initAnalytics once a provider is connected. */
    __tgSink?: (event: QueuedEvent) => void;
  }
}

/**
 * Records one funnel event.
 *
 * Safe to call anywhere — server-side it is a no-op, and with no provider
 * connected it simply buffers so nothing breaks and no data leaves the browser.
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const enriched: QueuedEvent = {
    ...event,
    at: Date.now(),
    path: window.location.pathname,
  };

  try {
    window.__tgAnalytics = window.__tgAnalytics ?? [];
    window.__tgAnalytics.push(enriched);
    // Keep the buffer bounded — this is a funnel, not a log store.
    if (window.__tgAnalytics.length > 200) window.__tgAnalytics.shift();

    window.__tgSink?.(enriched);

    if (import.meta.env.DEV) {
      console.debug("[track]", event.name, event);
    }
  } catch {
    // Analytics must never break the page.
  }
}

/**
 * Connects a provider. Call once, client-side.
 *
 * Example, once an endpoint exists:
 *
 *   initAnalytics((e) => navigator.sendBeacon("/api/events", JSON.stringify(e)));
 *
 * Buffered events recorded before connection are replayed, so nothing captured
 * during page load is lost.
 */
export function initAnalytics(sink: (event: QueuedEvent) => void): void {
  if (typeof window === "undefined") return;
  window.__tgSink = sink;
  for (const queued of window.__tgAnalytics ?? []) {
    try {
      sink(queued);
    } catch {
      /* a failing provider must not break the page */
    }
  }
}
