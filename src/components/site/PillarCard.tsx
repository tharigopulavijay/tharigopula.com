import { Link } from "@tanstack/react-router";
import type { Pillar } from "@/data/pillars";
import { Icons } from "./HomeGrids";

/**
 * A pillar presented as a product rather than a bullet.
 *
 * Icon, description, the concrete deliverables underneath, and a drawn strip of
 * what the work looks like. The preview matters — four cards of text read as a
 * capability list, which is what every agency site already is. Showing the
 * output is the difference between "we do dashboards" and "here is a dashboard".
 */

const ICON = {
  web: <Icons.customers />,
  software: <Icons.custom />,
  automation: <Icons.automate />,
  data: <Icons.reporting />,
} as const;

function Check({ color }: { color: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.5" opacity="0.35" />
      <path d="M8 12.2l2.7 2.6L16 9.5" />
    </svg>
  );
}

/* ---------- the drawn preview strips ---------- */

function WebStrip({ accent }: { accent: string }) {
  return (
    <div className="flex h-full gap-2 p-2.5">
      <div className="flex flex-1 flex-col justify-center rounded-md border border-border bg-card p-2">
        <p className="text-[10px] leading-tight font-semibold">Elevate your online presence</p>
        <div className="mt-1.5 flex flex-col gap-1">
          <span className="block h-1 w-full rounded-full bg-foreground/10" />
          <span className="block h-1 w-2/3 rounded-full bg-foreground/10" />
        </div>
        <span
          className="mt-2 inline-block w-fit rounded px-2 py-1 text-[8px] font-semibold text-white"
          style={{ background: accent }}
        >
          Get started
        </span>
      </div>
      <div
        className="w-1/3 shrink-0 rounded-md"
        style={{ background: "linear-gradient(155deg, #C9DDF2 0%, #8FB4DC 55%, #4E7CB0 100%)" }}
      />
    </div>
  );
}

function SoftwareStrip({ accent }: { accent: string }) {
  return (
    <div className="flex h-full gap-2 p-2.5">
      <div className="flex-1 rounded-md border border-border bg-card p-2">
        <div className="flex gap-2">
          <div>
            <span className="block text-[7px] text-muted-foreground">Revenue</span>
            <span className="block text-[10px] font-bold">₹8,42,900</span>
          </div>
          <div>
            <span className="block text-[7px] text-muted-foreground">Orders</span>
            <span className="block text-[10px] font-bold" style={{ color: accent }}>
              1,245
            </span>
          </div>
        </div>
        <div className="mt-2 flex h-8 items-end gap-1">
          {[42, 60, 48, 74, 56, 88].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, background: accent, opacity: i === 5 ? 1 : 0.3 }}
            />
          ))}
        </div>
      </div>
      <div className="w-[26%] shrink-0 rounded-md border border-border bg-card p-1.5">
        <span className="mx-auto block h-1 w-4 rounded-full bg-foreground/20" />
        <div className="mt-1.5 flex flex-col gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-1.5 w-full rounded-sm bg-foreground/[0.07]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationStrip({ accent }: { accent: string }) {
  const nodes = ["WA", "@", "DB", "AI"];
  return (
    <div className="flex h-full items-center justify-center gap-2 p-2.5">
      {nodes.map((n, i) => (
        <div key={n} className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-[9px] font-bold"
            style={{ color: accent }}
          >
            {n}
          </span>
          {i < nodes.length - 1 ? (
            <span className="block h-px w-3" style={{ background: `${accent}66` }} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DataStrip({ accent }: { accent: string }) {
  return (
    <div className="flex h-full gap-2 p-2.5">
      <div className="flex-1 rounded-md p-2" style={{ background: "#0C1626" }}>
        <svg viewBox="0 0 70 26" className="h-7 w-full" aria-hidden>
          <polyline
            points="0,22 12,16 24,19 36,10 48,13 60,5 70,2"
            fill="none"
            stroke={accent}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="mt-1 flex h-4 items-end gap-0.5">
          {[40, 58, 46, 70, 54, 84].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, background: accent, opacity: i === 5 ? 1 : 0.35 }}
            />
          ))}
        </div>
      </div>
      <div
        className="grid w-[26%] shrink-0 place-items-center rounded-md"
        style={{ background: "#0C1626" }}
      >
        <svg viewBox="0 0 36 36" className="h-9 w-9" aria-hidden>
          <circle cx="18" cy="18" r="14" fill="none" stroke="#22334A" strokeWidth="6" />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke={accent}
            strokeWidth="6"
            strokeDasharray="88"
            strokeDashoffset="26"
            transform="rotate(-90 18 18)"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function Strip({ pillar }: { pillar: Pillar }) {
  switch (pillar.id) {
    case "web":
      return <WebStrip accent={pillar.accent} />;
    case "software":
      return <SoftwareStrip accent={pillar.accent} />;
    case "automation":
      return <AutomationStrip accent={pillar.accent} />;
    case "data":
      return <DataStrip accent={pillar.accent} />;
  }
}

export function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
          style={{ background: pillar.accentSoft, color: pillar.accent }}
          aria-hidden
        >
          {ICON[pillar.id]}
        </span>
        <h3 className="font-display text-lg leading-snug font-semibold">{pillar.title}</h3>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {pillar.includes.map((i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-snug">
            <Check color={pillar.accent} />
            {i}
          </li>
        ))}
      </ul>

      <Link
        to={pillar.to}
        className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-medium"
        style={{ color: pillar.accent }}
      >
        Learn more{" "}
        <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">
          →
        </span>
      </Link>

      <div className="mt-5 h-[86px] overflow-hidden rounded-xl border border-border bg-secondary/40">
        <Strip pillar={pillar} />
      </div>
    </div>
  );
}
