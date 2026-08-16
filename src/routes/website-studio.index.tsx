import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Section, SectionHeading, Pill } from "@/components/site/primitives";
import { TemplateCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/CTASection";
import { templates, websiteCategories } from "@/data/templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/website-studio/")({
  head: () => ({
    meta: [
      { title: "Website Studio — Essential to Cinematic & 3D Websites | Tharigopula Technologies" },
      {
        name: "description",
        content:
          "Five website experience levels with indicative pricing: essential, dynamic business, premium interactive, cinematic and 3D immersive websites.",
      },
      { property: "og:title", content: "Website Studio | Tharigopula Technologies" },
      { property: "og:description", content: "Choose how your business should appear online — with clear price ranges." },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const [filter, setFilter] = useState<string>("all");
  const list = filter === "all" ? templates : templates.filter((t) => t.category === filter);

  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Website Studio"
          title="Choose how your business should appear online."
          lead="Not basic, standard and premium — actual experience categories, with what they include and what they cost."
        />
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-secondary/60 p-5">
          <p className="text-sm text-muted-foreground">
            Rather see the difference than read about it? The Experience Lab has the same business built five ways, live.
          </p>
          <Link
            to="/experience-lab"
            className="inline-flex items-center rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-signal-foreground"
          >
            Open the Experience Lab
          </Link>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {websiteCategories.map((c) => (
            <div key={c.slug} className="flex h-full flex-col rounded-xl border border-border bg-card p-6">
              <span className="font-mono text-xs text-signal">0{c.index}</span>
              <h2 className="mt-2 font-display text-xl font-semibold">{c.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.headline}</p>
              <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Suitable for</p>
              <p className="text-sm">{c.suitableFor.join(" · ")}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {c.features.map((f) => (
                  <li key={f} className="rounded-md bg-secondary px-2.5 py-1 text-xs">
                    {f}
                  </li>
                ))}
              </ul>
              {c.note ? <p className="mt-4 text-xs text-muted-foreground italic">{c.note}</p> : null}
              <p className="mt-auto border-t border-border pt-4 text-sm font-medium">{c.priceRange}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-secondary/40">
        <SectionHeading
          eyebrow="Template gallery"
          title="Start with a direction you like"
          lead="Templates are inspiration, not restrictive packages. We customise the design, content, workflows and functionality around your business."
        />
        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              filter === "all" ? "border-signal bg-signal/10 font-medium" : "border-border",
            )}
          >
            All styles
          </button>
          {websiteCategories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setFilter(c.slug)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                filter === c.slug ? "border-signal bg-signal/10 font-medium" : "border-border",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
        <p className="mt-8">
          <Pill>Heavy cinematic and 3D demos load separately so the main site stays fast on mobile.</Pill>
        </p>
      </Section>

      <CTASection title="Found a direction that fits?" body="Tell us which style you liked and what your business does. We will come back with a scoped proposal." />
    </>
  );
}
