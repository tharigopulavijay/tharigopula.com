import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Section } from "@/components/site/primitives";
import { DemoPageHeader } from "@/components/site/DemoPageHeader";
import { Phone, Tablet } from "@/components/site/DeviceFrames";
import { MobileAppDemo } from "@/components/site/MobileAppDemo";
import { CTABanner } from "@/components/site/CTABanner";
import { appPresets, presetById, type AppPreset } from "@/data/demo-apps";
import { systemById, inr } from "@/data/catalog";
import { whatsappLink } from "@/data/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/showcase/mobile-apps")({
  head: () => ({
    meta: [
      { title: "Mobile App Demos — Try Them On Phone & Tablet | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Tap through working ordering, booking, customer and business apps in real phone and tablet frames. No download, no login — see what your app could do.",
      },
      { property: "og:title", content: "Mobile App Demos | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Working app demos you can actually tap through, in real device frames.",
      },
    ],
  }),
  component: MobileAppDemosPage,
});

/** What the app shell is doing on each screen, in the buyer's terms. */
const STAGES: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Onboarding",
    body: "Welcome and sign-in flows that make a first impression and get people in without friction.",
  },
  {
    n: "02",
    title: "Home & discovery",
    body: "Search, categories and listings that put the thing a customer came for within one tap.",
  },
  {
    n: "03",
    title: "Orders & activity",
    body: "Live status on every order, booking or request, so nobody has to ring up and ask.",
  },
  {
    n: "04",
    title: "Profile & management",
    body: "Addresses, payment methods, preferences and support — handled by the customer, not your staff.",
  },
];

function MobileAppDemosPage() {
  const [active, setActive] = useState<AppPreset["id"]>("booking");
  const preset = presetById(active);

  return (
    <>
      <DemoPageHeader
        crumb="Mobile App Demos"
        title="Mobile app demos"
        accentTitle="in real device views."
        lead="Preview working apps on phone and tablet — explore the features, flows and experiences built to solve real business needs. Everything below is live; tap it."
        primary={{ to: "#try", label: "Try the demo", hash: "#try" }}
        secondary={{ to: "/contact", label: "Request custom demo" }}
        assurances={["No download required", "Four app types", "Phone & tablet views"]}
        visual={<HeaderVisual preset={preset} />}
      />

      {/* The demo itself */}
      <Section id="try">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
            Pick an app type and try it
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            One foundation, reshaped around four different businesses. The tabs, categories and
            lists below are all live.
          </p>
          <span aria-hidden className="mx-auto mt-5 block h-1 w-14 rounded-full bg-signal" />
        </div>

        <div
          role="tablist"
          aria-label="App type"
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {appPresets.map((p) => {
            const on = p.id === active;
            return (
              <button
                key={p.id}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setActive(p.id)}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-left transition-colors",
                  on
                    ? "border-signal bg-signal/10"
                    : "border-border bg-card hover:border-signal/50",
                )}
              >
                <span className="block text-[13px] font-semibold">{p.label}</span>
                <span className="block text-[11px] text-muted-foreground">{p.note}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-start lg:gap-12">
          {/* Phone. Keyed on the preset so switching resets the app to its home
              tab rather than leaving you on someone else's profile screen. */}
          <div className="flex flex-col items-center gap-3">
            <Phone key={`p-${preset.id}`} scale={0.92}>
              <MobileAppDemo preset={preset} />
            </Phone>
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              Phone view
            </p>
          </div>

          <div className="hidden flex-col items-center gap-3 md:flex">
            <Tablet key={`t-${preset.id}`} scale={0.78} landscape>
              <MobileAppDemo preset={preset} wide />
            </Tablet>
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              Tablet view
            </p>
          </div>

          <aside className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 lg:max-w-xs">
            <p className="eyebrow">{preset.label}</p>
            <h3 className="mt-2 font-display text-lg font-semibold">{preset.brand}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{preset.note}</p>

            <p className="mt-5 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Indicative price
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              From {inr(systemById("mobile").low)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Scope, platforms and integrations move this figure. The estimator gives a tighter
              range in about a minute.
            </p>

            <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
              {preset.categories.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: preset.accent }}
                  />
                  {c}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Section>

      {/* What each screen is for */}
      <Section className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
              <span className="font-mono text-[11px] tracking-[0.16em] text-signal">{s.n}</span>
              <h3 className="mt-3 font-display text-base leading-snug font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <CTABanner
          title="Want a demo tailored to your business?"
          body="Tell us how your customers order, book or pay, and we'll show you the app built around that — not a generic template."
          primary={{ to: "/start-project", label: "Get project estimate" }}
          whatsapp={whatsappLink(
            "Hello Tharigopula Technologies, I would like a mobile app demo for my business.",
          )}
        />
      </Section>
    </>
  );
}

/** Phone and tablet, angled, for the page header. */
function HeaderVisual({ preset }: { preset: AppPreset }) {
  return (
    <div className="flex items-start justify-center gap-4 sm:gap-6">
      <Phone scale={0.66} className="mt-8">
        <MobileAppDemo preset={preset} />
      </Phone>
      <div className="hidden sm:block">
        <Tablet scale={0.5} landscape>
          <MobileAppDemo preset={presetById("business")} wide />
        </Tablet>
      </div>
    </div>
  );
}
