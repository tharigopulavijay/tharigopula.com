import { createFileRoute } from "@tanstack/react-router";
import { Pill, Section, SectionHeading } from "@/components/site/primitives";
import { CTASection } from "@/components/site/CTASection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { costFactors, pricingCategories, supportPlans, thirdPartyCosts } from "@/data/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Custom Technology Without Agency Overhead | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Transparent, indicative pricing for websites, software, automation, data, AI and apps — premium work, accessible pricing, no hidden costs.",
      },
      { property: "og:title", content: "Pricing | Tharigopula Technologies" },
      {
        property: "og:description",
        content: "Custom technology without traditional agency overhead — clear starting points for every engagement.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Pricing"
          title="Custom technology without traditional agency overhead"
          lead="Premium in the quality of work, accessible in pricing, transparent about scope. Every figure below is indicative — final pricing is confirmed after we understand your requirement."
        />
      </Section>

      <Section className="pt-0">
        <Tabs defaultValue={pricingCategories[0]!.key} className="w-full">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            {pricingCategories.map((c) => (
              <TabsTrigger
                key={c.key}
                value={c.key}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium data-[state=active]:border-signal data-[state=active]:bg-signal data-[state=active]:text-signal-foreground"
              >
                {c.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {pricingCategories.map((c) => (
            <TabsContent key={c.key} value={c.key} className="mt-8">
              <p className="max-w-2xl text-sm text-muted-foreground">{c.blurb}</p>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {c.tiers.map((t) => (
                  <div
                    key={t.name}
                    className={cn(
                      "relative flex h-full flex-col rounded-xl border p-6",
                      t.popular ? "border-signal bg-signal/5" : "border-border bg-card",
                    )}
                  >
                    {t.popular ? (
                      <span className="absolute top-4 right-4 rounded-full bg-signal px-2.5 py-1 text-[11px] font-semibold text-signal-foreground">
                        Most popular
                      </span>
                    ) : null}
                    <h3 className="font-display text-lg font-semibold">{t.name}</h3>
                    <p className="mt-1 text-lg font-semibold text-signal">{t.price}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{t.audience}</p>
                    <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
                      {t.includes.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {t.note ? <p className="mt-4 text-xs text-muted-foreground/80 italic">{t.note}</p> : null}
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8">
          <a href="/experience-lab" className="text-sm font-medium text-foreground underline-offset-4 hover:text-signal hover:underline">
            See all experience levels →
          </a>
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Why pricing has changed"
          title="Better technology should reduce cost, not increase it."
          lead="Modern architecture, reusable engineering patterns, and automation and AI-assisted development remove a lot of repetitive implementation work. That time doesn't disappear — it's redirected into understanding your business, design, testing, integration, quality and ongoing support."
        />
      </Section>

      <Section>
        <SectionHeading eyebrow="Where the value goes" title="What you actually pay for" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Understanding your business",
            "Solution architecture",
            "UI / UX design",
            "Development",
            "Integration",
            "Testing",
            "Deployment",
            "Documentation and support",
          ].map((step) => (
            <div key={step} className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium">
              {step}
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Software tools are increasingly affordable. The difficult part is deciding what to build, connecting it
          correctly to your business, testing it, deploying it and ensuring people can actually use it.
        </p>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="How to start"
          title="Start small. Expand when the business needs it."
          lead="You don't need to buy every capability on day one. Begin with a right-sized, lean version of what you need, and grow it as your business grows — without compromising on quality at any stage."
        />
      </Section>

      <Section>
        <SectionHeading eyebrow="What moves the price" title="Cost depends on scope, not guesswork" />
        <ul className="mt-8 flex flex-wrap gap-2">
          {costFactors.map((f) => (
            <li key={f}>
              <Pill>{f}</Pill>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading eyebrow="Ongoing support" title="Systems need care after launch" />
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {supportPlans.map((p) => (
            <div
              key={p.name}
              className={cn(
                "flex h-full flex-col rounded-xl border p-6",
                p.featured ? "border-signal bg-signal/5" : "border-border bg-card",
              )}
            >
              {p.featured ? (
                <span className="mb-3 inline-flex w-fit rounded-full bg-signal px-2.5 py-1 text-[11px] font-semibold text-signal-foreground">
                  Most popular
                </span>
              ) : null}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm font-medium">{p.price}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Third-party costs"
          title="Billed at actuals, never marked up"
          lead="Domain, hosting, database, cloud, email, SMS, WhatsApp API, payment gateways, AI APIs, maps, storage, app stores, commercial licences, automation platforms and 3D tooling are paid directly by you or passed on at cost."
        />
        <ul className="mt-8 flex flex-wrap gap-2">
          {thirdPartyCosts.map((c) => (
            <li key={c}>
              <Pill>{c}</Pill>
            </li>
          ))}
        </ul>
      </Section>

      <CTASection title="Get an indicative estimate for your project" body="Answer a few questions and we will come back with a scoped, transparent range." />
    </>
  );
}
