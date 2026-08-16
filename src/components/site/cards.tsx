import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SolutionGroup } from "@/data/solutions";
import type { Industry } from "@/data/industries";
import type { Template } from "@/data/templates";
import { categoryBySlug, demoPathFor, keyCapability } from "@/data/templates";
import type { CaseStudy } from "@/data/portfolio";
import { Pill } from "./primitives";
import { TemplatePreview } from "./TemplatePreview";

export function SolutionCard({ group, className }: { group: SolutionGroup; className?: string | undefined }) {
  return (
    <div
      id={group.slug}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      <h3 className="font-display text-xl font-semibold">{group.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{group.summary}</p>
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {group.items.map((item) => (
          <li key={item} className="rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-auto border-t border-border pt-4 text-sm text-foreground">
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Outcome</span>
        <br />
        {group.outcome}
      </p>
    </div>
  );
}

export function IndustryCard({ industry }: { industry: Industry }) {
  return (
    <Link
      to="/industries/$slug"
      params={{ slug: industry.slug }}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lift"
    >
      <h3 className="font-display text-lg font-semibold">{industry.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{industry.tagline}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground group-hover:text-signal">
        Explore solutions <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

export function TemplateCard({ template }: { template: Template }) {
  const category = categoryBySlug(template.category);
  const demoPath = demoPathFor(template.category);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <Link
        to="/website-studio/$slug"
        params={{ slug: template.slug }}
        className="relative block overflow-hidden border-b border-border"
        aria-label={`${template.name} template preview`}
      >
        <TemplatePreview template={template} interactive />
        <span className="absolute top-3 left-3 rounded bg-background/85 px-2 py-1 font-mono text-[10px] tracking-[0.12em] uppercase backdrop-blur-sm">
          {category?.name ?? template.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{template.name}</h3>
          <Pill>{template.complexity}</Pill>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{template.industry}</p>

        <p className="mt-3 flex items-start gap-2 text-sm">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
          {keyCapability[template.slug] ?? template.features[0]}
        </p>

        <p className="mt-4 border-t border-border pt-3 text-sm">
          <span className="font-medium">{template.priceRange}</span>
          <span className="text-muted-foreground"> · {template.timeline}</span>
        </p>

        <div className="mt-4 flex gap-2">
          <a
            href={demoPath}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm font-medium transition-colors hover:border-signal hover:text-signal"
          >
            Preview live
          </a>
          <Link
            to="/website-studio/$slug"
            params={{ slug: template.slug }}
            className="flex-1 rounded-md bg-ink px-3 py-2 text-center text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90"
          >
            Build this
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProjectCard({ study }: { study: CaseStudy }) {
  return (
    <Link
      to="/portfolio/$slug"
      params={{ slug: study.slug }}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{study.industry}</p>
      <h3 className="mt-3 font-display text-xl leading-snug font-semibold">{study.title}</h3>
      <p className="mt-3 text-sm text-muted-foreground">{study.summary}</p>
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {study.tech.slice(0, 5).map((t) => (
          <li key={t} className="rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            {t}
          </li>
        ))}
      </ul>
      <span className="mt-auto pt-5 text-sm font-medium group-hover:text-signal">Read the case study →</span>
    </Link>
  );
}

export function StepList({ items }: { items: { id: string; title: string; body: string }[] }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <li key={s.id} className="bg-card p-6">
          <span className="font-mono text-xs text-signal">{s.id}</span>
          <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function FeatureGrid({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <div key={i.title} className="bg-card p-6">
          <h3 className="font-display text-base font-semibold">{i.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{i.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-border p-5">
      <p className="font-display text-2xl font-semibold text-ink-foreground">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
