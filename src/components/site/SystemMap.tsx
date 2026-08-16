import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const nodes = [
  { id: "website", label: "Website", note: "How customers find and contact you." },
  { id: "customers", label: "Customers", note: "One record per customer, everywhere." },
  { id: "sales", label: "Sales", note: "Enquiry to order, with an owner at each stage." },
  { id: "operations", label: "Operations", note: "Stock, service, delivery, jobs." },
  { id: "data", label: "Data", note: "One database instead of eight spreadsheets." },
  { id: "automation", label: "Automation", note: "Reminders, approvals and reports that run themselves." },
  { id: "ai", label: "AI", note: "Reading, sorting and drafting handled for you." },
  { id: "management", label: "Management", note: "Live numbers without asking anyone." },
];

export function SystemMap() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((i) => (i + 1) % nodes.length), 2600);
    return () => clearInterval(t);
  }, []);

  const current = nodes[active]!;

  return (
    <div className="rounded-xl border border-ink-border bg-white/[0.03] p-4 sm:p-6">
      <p className="font-mono text-[10px] tracking-[0.18em] text-ink-muted uppercase">Connected business systems</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {nodes.map((n, i) => (
          <button
            key={n.id}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm transition-all duration-300",
              i === active
                ? "border-signal bg-signal/15 text-ink-foreground"
                : "border-ink-border text-ink-muted hover:border-ink-foreground/30",
            )}
          >
            <span className="block font-display font-medium">{n.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-3 border-t border-ink-border pt-4">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
        <p className="text-sm text-ink-muted">
          <span className="text-ink-foreground">{current.label}:</span> {current.note}
        </p>
      </div>
    </div>
  );
}
