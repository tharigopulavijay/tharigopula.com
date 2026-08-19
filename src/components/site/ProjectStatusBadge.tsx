import { statusMeta, type ProjectStatus } from "@/data/project-status";
import { cn } from "@/lib/utils";

/**
 * States plainly whether a project was delivered for a client or designed to
 * demonstrate an approach. Shown on every card and every case study page, so a
 * visitor never has to guess which they are looking at.
 */

const TONE: Record<string, string> = {
  proof: "border-signal/40 bg-signal/10 text-signal",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  illustrative: "border-border bg-secondary text-muted-foreground",
};

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] uppercase",
        TONE[meta.weight],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

/** The badge plus its plain-English meaning — used at the top of a case study. */
export function ProjectStatusNote({ status }: { status: ProjectStatus }) {
  const meta = statusMeta(status);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
      <ProjectStatusBadge status={status} className="w-fit shrink-0" />
      <p className="text-sm text-muted-foreground">{meta.meaning}</p>
    </div>
  );
}
