import { Icons } from "./HomeGrids";

/**
 * Six industries arranged around the visitor's own business.
 *
 * Deliberately the inverse of the hero showcase on the homepage. There, four
 * products orbit the company mark — here, six industries orbit "Your Business",
 * because on this page the visitor is the centre and the question is which ring
 * they belong to. Same visual language, opposite argument.
 *
 * Orbital from lg; a plain grid below that, where absolute positioning collapses.
 */

export type OrbitIndustry = {
  slug: string;
  name: string;
  note: string;
  icon: React.ReactNode;
  tint: string;
  color: string;
};

export const ORBIT: OrbitIndustry[] = [
  {
    slug: "manufacturing",
    name: "Manufacturing",
    note: "Smart operations",
    icon: <Icons.factory />,
    tint: "#E8F0FE",
    color: "#2563EB",
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    note: "Better care",
    icon: <Icons.clinic />,
    tint: "#E3F5ED",
    color: "#0EA36B",
  },
  {
    slug: "restaurants",
    name: "Restaurants",
    note: "Seamless service",
    icon: <Icons.restaurant />,
    tint: "#FDF0DC",
    color: "#E08411",
  },
  {
    slug: "retail",
    name: "Retail",
    note: "Unified commerce",
    icon: <Icons.retail />,
    tint: "#F0EAFC",
    color: "#7C4DDA",
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    note: "Stronger deals",
    icon: <Icons.realEstate />,
    tint: "#E3F5ED",
    color: "#0EA36B",
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    note: "Smarter delivery",
    icon: <Icons.professional />,
    tint: "#F0EAFC",
    color: "#7C4DDA",
  },
];

function Chip({ item }: { item: OrbitIndustry }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{ background: item.tint, color: item.color }}
        aria-hidden
      >
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] leading-tight font-semibold">{item.name}</span>
        <span className="block truncate text-[10.5px] text-muted-foreground">{item.note}</span>
      </span>
    </div>
  );
}

function Core() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid h-[74px] w-[74px] place-items-center rounded-full border border-border bg-card shadow-sm">
        <img
          src="/logo-mark.png"
          alt=""
          width={96}
          height={96}
          className="h-9 w-9 object-contain"
        />
      </div>
      <span className="text-[13px] font-semibold">Your Business</span>
    </div>
  );
}

export function IndustryOrbit() {
  return (
    <div className="relative">
      {/* Small and medium screens — no absolute positioning. */}
      <div className="lg:hidden">
        <div className="mb-5 flex justify-center">
          <Core />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ORBIT.map((i) => (
            <Chip key={i.slug} item={i} />
          ))}
        </div>
      </div>

      {/* Large screens — six industries ringed around the centre. */}
      <div className="relative hidden aspect-[4/3.5] w-full lg:block">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border"
        />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/70"
        />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Core />
        </div>

        {/* top · upper-left · upper-right · lower-left · lower-right · bottom */}
        <div className="absolute top-0 left-1/2 w-[42%] -translate-x-1/2">
          <Chip item={ORBIT[0]!} />
        </div>
        <div className="absolute top-[26%] left-0 w-[40%]">
          <Chip item={ORBIT[5]!} />
        </div>
        <div className="absolute top-[26%] right-0 w-[38%]">
          <Chip item={ORBIT[1]!} />
        </div>
        <div className="absolute bottom-[26%] left-0 w-[38%]">
          <Chip item={ORBIT[4]!} />
        </div>
        <div className="absolute right-0 bottom-[26%] w-[38%]">
          <Chip item={ORBIT[2]!} />
        </div>
        <div className="absolute bottom-0 left-1/2 w-[38%] -translate-x-1/2">
          <Chip item={ORBIT[3]!} />
        </div>
      </div>
    </div>
  );
}
