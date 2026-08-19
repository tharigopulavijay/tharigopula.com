import { useEffect, useRef, useState } from "react";
import type { Template } from "@/data/templates";
import { cn } from "@/lib/utils";

/**
 * TemplatePreview — a genuine miniature website, not an abstract colour block.
 *
 * Each template renders a real layout for its industry: a restaurant shows a
 * menu with prices, a clinic shows doctors and a booking panel, a manufacturer
 * shows a product grid with specifications. Structure differs, not just colour,
 * so a visitor comparing two templates sees two different websites.
 *
 * Everything is drawn at a fixed design size and scaled to the container, so
 * proportions stay truthful at any card width.
 */

const DESIGN_W = 720;
const DESIGN_H = 450;

type Palette = { ink: string; paper: string; accent: string };

export function TemplatePreview({
  template,
  className,
  interactive = false,
}: {
  template: Template;
  className?: string;
  /** Adds a subtle lift on hover — used on cards, not on the detail hero. */
  interactive?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / DESIGN_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const palette: Palette = {
    ink: template.palette[0],
    paper: template.palette[1],
    accent: template.palette[2],
  };

  return (
    <div
      ref={shellRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}`, backgroundColor: palette.paper }}
      aria-hidden
    >
      <div
        className={cn(
          "origin-top-left",
          interactive && "transition-transform duration-500 group-hover:scale-[1.03]",
        )}
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <Layout template={template} p={palette} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Layout({ template, p }: { template: Template; p: Palette }) {
  switch (template.slug) {
    case "modern-minimal":
      return <MinimalLayout p={p} />;
    case "editorial-content":
      return <EditorialLayout p={p} />;
    case "healthcare-clinic":
      return <ClinicLayout p={p} />;
    case "restaurant-hospitality":
      return <RestaurantLayout p={p} />;
    case "industrial-manufacturing":
      return <IndustrialLayout p={p} />;
    case "technology-product":
      return <ProductLayout p={p} />;
    case "finance-trust":
      return <FinanceLayout p={p} />;
    case "creative-studio":
      return <CreativeLayout p={p} />;
    case "luxury-brand":
      return <LuxuryLayout p={p} />;
    case "real-estate-cinematic":
      return <RealEstateLayout p={p} />;
    case "product-3d":
      return <ImmersiveLayout p={p} />;
    case "corporate-professional":
    default:
      return <CorporateLayout p={p} />;
  }
}

/* ---------- shared atoms ---------- */

function Nav({
  p,
  brand,
  items,
  cta,
  dark = false,
  centered = false,
}: {
  p: Palette;
  brand: string;
  items: string[];
  cta?: string;
  dark?: boolean;
  centered?: boolean;
}) {
  const fg = dark ? p.paper : p.ink;
  return (
    <div
      className={cn("flex items-center px-9 py-5", centered ? "flex-col gap-3" : "justify-between")}
      style={{ borderBottom: `1px solid ${fg}18` }}
    >
      <span style={{ color: fg, fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {brand}
      </span>
      <div className="flex items-center gap-6">
        {items.map((i) => (
          <span key={i} style={{ color: `${fg}A8`, fontSize: 10.5 }}>
            {i}
          </span>
        ))}
        {cta && (
          <span
            className="rounded"
            style={{
              background: p.accent,
              color: p.paper,
              fontSize: 10,
              padding: "6px 12px",
              fontWeight: 600,
            }}
          >
            {cta}
          </span>
        )}
      </div>
    </div>
  );
}

function Lines({ color, widths, gap = 7 }: { color: string; widths: number[]; gap?: number }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {widths.map((w, i) => (
        <div
          key={i}
          style={{ height: 5, width: w, background: color, borderRadius: 3, opacity: 0.22 }}
        />
      ))}
    </div>
  );
}

function Btn({ p, label, solid = true }: { p: Palette; label: string; solid?: boolean }) {
  return (
    <span
      className="inline-flex rounded"
      style={{
        background: solid ? p.accent : "transparent",
        border: solid ? "none" : `1px solid ${p.ink}35`,
        color: solid ? p.paper : p.ink,
        fontSize: 10.5,
        fontWeight: 600,
        padding: "9px 16px",
      }}
    >
      {label}
    </span>
  );
}

/* ---------- 01 · Corporate ---------- */

function CorporateLayout({ p }: { p: Palette }) {
  return (
    <div className="h-full w-full" style={{ background: p.paper }}>
      <Nav p={p} brand="MERIDIAN" items={["About", "Services", "Insights"]} cta="Contact" />
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-8 px-9 pt-9">
        <div>
          <div style={{ color: p.accent, fontSize: 9.5, letterSpacing: "0.18em", fontWeight: 600 }}>
            ADVISORY &amp; CONSULTING
          </div>
          <div
            style={{
              color: p.ink,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.15,
              marginTop: 10,
              letterSpacing: "-0.03em",
            }}
          >
            Clarity for complex
            <br />
            business decisions.
          </div>
          <div className="mt-4">
            <Lines color={p.ink} widths={[300, 260]} />
          </div>
          <div className="mt-6 flex gap-3">
            <Btn p={p} label="Book a consultation" />
            <Btn p={p} label="Our work" solid={false} />
          </div>
        </div>
        <div
          className="rounded"
          style={{ background: `${p.ink}0D`, border: `1px solid ${p.ink}12` }}
        />
      </div>
      <div className="mt-9 grid grid-cols-3 gap-4 px-9">
        {["Strategy", "Operations", "Compliance"].map((s) => (
          <div key={s} className="rounded p-4" style={{ border: `1px solid ${p.ink}18` }}>
            <div
              style={{ width: 20, height: 20, background: p.accent, borderRadius: 4, opacity: 0.9 }}
            />
            <div style={{ color: p.ink, fontSize: 12, fontWeight: 600, marginTop: 10 }}>{s}</div>
            <div className="mt-2">
              <Lines color={p.ink} widths={[150, 120]} gap={5} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 02 · Minimal ---------- */

function MinimalLayout({ p }: { p: Palette }) {
  return (
    <div className="flex h-full w-full flex-col" style={{ background: p.paper }}>
      <Nav p={p} brand="norr." items={["Work", "Studio", "Contact"]} />
      <div className="flex flex-1 flex-col items-center justify-center px-24 text-center">
        <div style={{ color: p.accent, fontSize: 9.5, letterSpacing: "0.24em", fontWeight: 600 }}>
          EST. 2024
        </div>
        <div
          style={{
            color: p.ink,
            fontSize: 42,
            fontWeight: 400,
            lineHeight: 1.1,
            marginTop: 18,
            letterSpacing: "-0.04em",
          }}
        >
          We make quiet
          <br />
          things well.
        </div>
        <div style={{ width: 40, height: 1, background: `${p.ink}40`, margin: "24px 0" }} />
        <div style={{ color: `${p.ink}88`, fontSize: 11, lineHeight: 1.7, maxWidth: 330 }}>
          A small studio working on brand, product and the spaces between them.
        </div>
        <div className="mt-7">
          <Btn p={p} label="Start a project" solid={false} />
        </div>
      </div>
      <div className="flex justify-between px-9 py-5" style={{ borderTop: `1px solid ${p.ink}12` }}>
        {["hello@norr.studio", "Bengaluru", "©2026"].map((t) => (
          <span key={t} style={{ color: `${p.ink}66`, fontSize: 9.5 }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- 03 · Editorial ---------- */

function EditorialLayout({ p }: { p: Palette }) {
  const posts = [
    ["How assessment actually improves recall", "Pedagogy", "12 Aug"],
    ["Designing a syllabus around outcomes", "Curriculum", "04 Aug"],
    ["What a good feedback loop looks like", "Practice", "28 Jul"],
  ];
  return (
    <div className="h-full w-full" style={{ background: p.paper }}>
      <div className="px-9 py-5 text-center" style={{ borderBottom: `2px solid ${p.ink}` }}>
        <div style={{ color: p.ink, fontSize: 22, fontWeight: 700, letterSpacing: "0.14em" }}>
          THE LEDGER
        </div>
        <div style={{ color: `${p.ink}80`, fontSize: 9, letterSpacing: "0.16em", marginTop: 3 }}>
          NOTES ON TEACHING &amp; LEARNING
        </div>
      </div>
      <div className="flex gap-5 px-9 py-3" style={{ borderBottom: `1px solid ${p.ink}18` }}>
        {["Latest", "Pedagogy", "Curriculum", "Research", "Archive"].map((c) => (
          <span key={c} style={{ color: `${p.ink}9A`, fontSize: 10 }}>
            {c}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-7 px-9 pt-6">
        <div>
          <div
            className="rounded"
            style={{ height: 108, background: `${p.accent}22`, border: `1px solid ${p.ink}12` }}
          />
          <div
            style={{
              color: p.accent,
              fontSize: 9,
              letterSpacing: "0.16em",
              fontWeight: 600,
              marginTop: 12,
            }}
          >
            FEATURE
          </div>
          <div
            style={{
              color: p.ink,
              fontSize: 19,
              fontWeight: 700,
              lineHeight: 1.25,
              marginTop: 6,
              letterSpacing: "-0.02em",
            }}
          >
            The quiet case for slower marking
          </div>
          <div className="mt-3">
            <Lines color={p.ink} widths={[330, 300, 250]} gap={6} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {posts.map(([title, tag, date]) => (
            <div key={title} className="pb-3" style={{ borderBottom: `1px solid ${p.ink}15` }}>
              <div
                style={{ color: p.accent, fontSize: 8.5, letterSpacing: "0.14em", fontWeight: 600 }}
              >
                {tag!.toUpperCase()} · {date}
              </div>
              <div
                style={{
                  color: p.ink,
                  fontSize: 11.5,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  marginTop: 4,
                }}
              >
                {title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 04 · Clinic ---------- */

function ClinicLayout({ p }: { p: Palette }) {
  return (
    <div className="h-full w-full" style={{ background: p.paper }}>
      <Nav p={p} brand="Aarogya Clinic" items={["Doctors", "Services", "Contact"]} cta="Book now" />
      <div className="grid grid-cols-[1fr_290px] gap-7 px-9 pt-8">
        <div>
          <div style={{ color: p.accent, fontSize: 9.5, letterSpacing: "0.18em", fontWeight: 600 }}>
            MULTI-SPECIALITY CARE
          </div>
          <div
            style={{
              color: p.ink,
              fontSize: 27,
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 10,
              letterSpacing: "-0.03em",
            }}
          >
            Care that respects
            <br />
            your time.
          </div>
          <div className="mt-4">
            <Lines color={p.ink} widths={[280, 230]} />
          </div>
          <div className="mt-6 flex gap-3">
            {["Physiotherapy", "Dermatology", "General"].map((s) => (
              <div key={s} className="rounded px-3 py-2" style={{ background: `${p.accent}18` }}>
                <span style={{ color: p.ink, fontSize: 10, fontWeight: 600 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        {/* booking panel */}
        <div className="rounded p-4" style={{ background: p.ink }}>
          <div style={{ color: p.paper, fontSize: 12, fontWeight: 700 }}>Book an appointment</div>
          <div className="mt-3 flex flex-col gap-2">
            {["Select doctor", "Choose date", "Choose time"].map((f) => (
              <div
                key={f}
                className="rounded px-2.5 py-2"
                style={{ background: `${p.paper}14`, border: `1px solid ${p.paper}22` }}
              >
                <span style={{ color: `${p.paper}9A`, fontSize: 9.5 }}>{f}</span>
              </div>
            ))}
          </div>
          <div
            className="mt-3 rounded py-2 text-center"
            style={{ background: p.accent, color: p.paper, fontSize: 10.5, fontWeight: 700 }}
          >
            Confirm booking
          </div>
        </div>
      </div>
      <div className="mt-7 grid grid-cols-3 gap-4 px-9">
        {["Dr. Rao", "Dr. Iyer", "Dr. Menon"].map((d) => (
          <div
            key={d}
            className="flex items-center gap-3 rounded p-3"
            style={{ border: `1px solid ${p.ink}18` }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 99, background: `${p.accent}30` }} />
            <div>
              <div style={{ color: p.ink, fontSize: 11, fontWeight: 600 }}>{d}</div>
              <div style={{ color: `${p.ink}80`, fontSize: 9 }}>MBBS, MD</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 05 · Restaurant ---------- */

function RestaurantLayout({ p }: { p: Palette }) {
  const menu = [
    ["Appam with stew", "₹340"],
    ["Meen moilee", "₹520"],
    ["Kallumakkaya fry", "₹460"],
  ];
  return (
    <div className="h-full w-full" style={{ background: p.ink }}>
      <Nav p={p} brand="SPICE ROUTE" items={["Menu", "Story", "Gallery"]} cta="Reserve" dark />
      <div className="px-9 pt-7">
        <div style={{ color: p.accent, fontSize: 9.5, letterSpacing: "0.22em", fontWeight: 600 }}>
          COASTAL KITCHEN &amp; BAR
        </div>
        <div
          style={{
            color: p.paper,
            fontSize: 34,
            fontWeight: 400,
            lineHeight: 1.12,
            marginTop: 10,
            letterSpacing: "-0.03em",
          }}
        >
          The sea, cooked
          <br />
          the old way.
        </div>
      </div>
      <div className="mt-6 grid grid-cols-[1fr_240px] gap-7 px-9">
        <div>
          <div
            style={{
              color: p.accent,
              fontSize: 9,
              letterSpacing: "0.18em",
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            FROM THE KITCHEN
          </div>
          {menu.map(([dish, price]) => (
            <div
              key={dish}
              className="flex items-baseline justify-between py-2.5"
              style={{ borderBottom: `1px solid ${p.paper}18` }}
            >
              <span style={{ color: p.paper, fontSize: 12 }}>{dish}</span>
              <span style={{ color: p.accent, fontSize: 11, fontWeight: 600 }}>{price}</span>
            </div>
          ))}
        </div>
        <div
          className="rounded"
          style={{
            background: `linear-gradient(150deg, ${p.accent}55, ${p.accent}18)`,
            border: `1px solid ${p.paper}18`,
          }}
        />
      </div>
      <div className="mt-6 flex items-center justify-between px-9">
        <span style={{ color: `${p.paper}88`, fontSize: 9.5 }}>
          Open 12:00 – 23:00 · Indiranagar
        </span>
        <Btn p={p} label="Book a table" />
      </div>
    </div>
  );
}

/* ---------- 06 · Industrial ---------- */

function IndustrialLayout({ p }: { p: Palette }) {
  const products = [
    ["OW-5HP", "Openwell 5HP", "38,400"],
    ["BW-7HP", "Borewell 7.5HP", "61,200"],
    ["MN-2HP", "Monoblock 2HP", "14,800"],
  ];
  return (
    <div className="h-full w-full" style={{ background: p.paper }}>
      <Nav
        p={p}
        brand="SURYAN INDUSTRIES"
        items={["Products", "Applications", "Downloads"]}
        cta="Enquire"
      />
      <div className="grid grid-cols-[1fr_1fr] gap-7 px-9 pt-7">
        <div>
          <div style={{ color: p.accent, fontSize: 9, letterSpacing: "0.2em", fontWeight: 600 }}>
            ISO 9001 · SINCE 1994
          </div>
          <div
            style={{
              color: p.ink,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.18,
              marginTop: 9,
              letterSpacing: "-0.03em",
            }}
          >
            Pumps built for
            <br />
            the long season.
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["120+", "Models"],
              ["38", "Countries"],
              ["30yr", "Field data"],
            ].map(([v, k]) => (
              <div key={k} className="rounded p-2.5" style={{ background: `${p.ink}0A` }}>
                <div style={{ color: p.accent, fontSize: 15, fontWeight: 700 }}>{v}</div>
                <div style={{ color: `${p.ink}80`, fontSize: 8.5, letterSpacing: "0.1em" }}>
                  {k!.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="rounded"
          style={{ background: `${p.ink}0F`, border: `1px solid ${p.ink}1A` }}
        />
      </div>
      {/* spec table */}
      <div
        className="mx-9 mt-6 rounded"
        style={{ border: `1px solid ${p.ink}1A`, overflow: "hidden" }}
      >
        <div
          className="grid grid-cols-[90px_1fr_90px] px-3 py-2"
          style={{ background: `${p.ink}0D` }}
        >
          {["CODE", "PRODUCT", "PRICE ₹"].map((h) => (
            <span
              key={h}
              style={{ color: `${p.ink}88`, fontSize: 8, letterSpacing: "0.14em", fontWeight: 600 }}
            >
              {h}
            </span>
          ))}
        </div>
        {products.map(([sku, name, price]) => (
          <div
            key={sku}
            className="grid grid-cols-[90px_1fr_90px] px-3 py-2.5"
            style={{ borderTop: `1px solid ${p.ink}12` }}
          >
            <span style={{ color: `${p.ink}90`, fontSize: 9.5 }}>{sku}</span>
            <span style={{ color: p.ink, fontSize: 10.5, fontWeight: 500 }}>{name}</span>
            <span style={{ color: p.accent, fontSize: 10.5, fontWeight: 600 }}>{price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 07 · Technology product ---------- */

function ProductLayout({ p }: { p: Palette }) {
  return (
    <div className="h-full w-full" style={{ background: p.ink }}>
      <Nav p={p} brand="Cadence" items={["Product", "Pricing", "Docs"]} cta="Try free" dark />
      <div className="px-9 pt-8 text-center">
        <div
          className="mx-auto inline-flex rounded px-3 py-1"
          style={{ background: `${p.accent}22`, border: `1px solid ${p.accent}44` }}
        >
          <span style={{ color: p.accent, fontSize: 9, letterSpacing: "0.12em", fontWeight: 600 }}>
            NOW WITH LIVE SYNC
          </span>
        </div>
        <div
          style={{
            color: p.paper,
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.14,
            marginTop: 12,
            letterSpacing: "-0.035em",
          }}
        >
          Ship work without
          <br />
          the status meeting.
        </div>
      </div>
      {/* app mock */}
      <div
        className="mx-9 mt-6 overflow-hidden rounded"
        style={{ background: `${p.paper}0A`, border: `1px solid ${p.paper}1F` }}
      >
        <div className="flex gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${p.paper}14` }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ width: 6, height: 6, borderRadius: 99, background: `${p.paper}35` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-3 p-3">
          <div className="flex flex-col gap-1.5">
            {["Overview", "Board", "Timeline", "Reports"].map((n, i) => (
              <div
                key={n}
                className="rounded px-2 py-1.5"
                style={{ background: i === 1 ? `${p.accent}2A` : "transparent" }}
              >
                <span
                  style={{
                    color: i === 1 ? p.accent : `${p.paper}80`,
                    fontSize: 9,
                    fontWeight: i === 1 ? 600 : 400,
                  }}
                >
                  {n}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Backlog", "Active", "Done"].map((col) => (
              <div key={col} className="rounded p-2" style={{ background: `${p.paper}09` }}>
                <span style={{ color: `${p.paper}9A`, fontSize: 8.5, fontWeight: 600 }}>{col}</span>
                <div className="mt-2 flex flex-col gap-1.5">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="rounded p-1.5"
                      style={{ background: `${p.paper}0E`, borderLeft: `2px solid ${p.accent}` }}
                    >
                      <div
                        style={{
                          height: 3,
                          width: "70%",
                          background: `${p.paper}35`,
                          borderRadius: 2,
                        }}
                      />
                      <div
                        style={{
                          height: 3,
                          width: "45%",
                          background: `${p.paper}22`,
                          borderRadius: 2,
                          marginTop: 3,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 08 · Finance ---------- */

function FinanceLayout({ p }: { p: Palette }) {
  return (
    <div className="h-full w-full" style={{ background: p.paper }}>
      <Nav p={p} brand="NORTHFIELD" items={["Loans", "Insurance", "Advisory"]} cta="Apply" />
      <div className="grid grid-cols-[1fr_270px] gap-7 px-9 pt-8">
        <div>
          <div style={{ color: p.accent, fontSize: 9, letterSpacing: "0.2em", fontWeight: 600 }}>
            REGULATED · SINCE 1998
          </div>
          <div
            style={{
              color: p.ink,
              fontSize: 27,
              fontWeight: 700,
              lineHeight: 1.18,
              marginTop: 9,
              letterSpacing: "-0.03em",
            }}
          >
            Borrow with the
            <br />
            numbers in front of you.
          </div>
          <div className="mt-4">
            <Lines color={p.ink} widths={[290, 240]} />
          </div>
          <div className="mt-5 flex gap-3">
            <Btn p={p} label="Check eligibility" />
            <Btn p={p} label="Talk to an advisor" solid={false} />
          </div>
        </div>
        {/* calculator */}
        <div
          className="rounded p-4"
          style={{ border: `1px solid ${p.ink}1F`, background: `${p.ink}06` }}
        >
          <div style={{ color: p.ink, fontSize: 11, fontWeight: 700 }}>EMI calculator</div>
          {[
            ["Loan amount", "₹25,00,000"],
            ["Tenure", "20 years"],
          ].map(([k, v]) => (
            <div key={k} className="mt-3">
              <div className="flex justify-between">
                <span style={{ color: `${p.ink}88`, fontSize: 9 }}>{k}</span>
                <span style={{ color: p.ink, fontSize: 9.5, fontWeight: 600 }}>{v}</span>
              </div>
              <div className="mt-1.5 rounded-full" style={{ height: 4, background: `${p.ink}18` }}>
                <div style={{ height: 4, width: "62%", background: p.accent, borderRadius: 99 }} />
              </div>
            </div>
          ))}
          <div className="mt-4 rounded p-2.5 text-center" style={{ background: p.ink }}>
            <div style={{ color: `${p.paper}9A`, fontSize: 8.5, letterSpacing: "0.12em" }}>
              MONTHLY EMI
            </div>
            <div style={{ color: p.paper, fontSize: 17, fontWeight: 700, marginTop: 2 }}>
              ₹21,450
            </div>
          </div>
        </div>
      </div>
      <div className="mt-7 flex gap-6 px-9">
        {[
          ["₹2,400 Cr", "Disbursed"],
          ["48 hrs", "Approval"],
          ["9.2%", "From"],
        ].map(([v, k]) => (
          <div key={k}>
            <div style={{ color: p.ink, fontSize: 16, fontWeight: 700 }}>{v}</div>
            <div style={{ color: `${p.ink}80`, fontSize: 8.5, letterSpacing: "0.12em" }}>
              {k!.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 09 · Creative ---------- */

function CreativeLayout({ p }: { p: Palette }) {
  return (
    <div className="h-full w-full overflow-hidden" style={{ background: p.paper }}>
      <div className="flex items-center justify-between px-9 py-5">
        <span style={{ color: p.ink, fontSize: 14, fontWeight: 700 }}>◆ FIELDWORK</span>
        <span style={{ color: p.ink, fontSize: 10.5 }}>Index · Info · Contact</span>
      </div>
      <div className="px-9">
        <div
          style={{
            color: p.ink,
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-0.055em",
          }}
        >
          MAKING
        </div>
        <div className="flex items-end gap-4">
          <span
            style={{
              color: p.accent,
              fontSize: 60,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: "-0.055em",
              fontStyle: "italic",
            }}
          >
            THINGS
          </span>
          <span
            style={{
              color: `${p.ink}88`,
              fontSize: 10.5,
              lineHeight: 1.5,
              maxWidth: 170,
              paddingBottom: 8,
            }}
          >
            Brand, film and interaction for people who care about the details.
          </span>
        </div>
        <div
          style={{
            color: p.ink,
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-0.055em",
          }}
        >
          MATTER
        </div>
      </div>
      <div className="mt-6 grid grid-cols-[1.6fr_1fr_1.2fr] gap-3 px-9">
        {[130, 96, 112].map((h, i) => (
          <div
            key={i}
            className="rounded"
            style={{
              height: h,
              background: i === 1 ? p.accent : `${p.ink}12`,
              opacity: i === 1 ? 0.85 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- 10 · Luxury ---------- */

function LuxuryLayout({ p }: { p: Palette }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: p.ink }}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 15%, ${p.accent}30, transparent 62%)`,
        }}
      />
      <div className="relative flex items-center justify-between px-10 py-6">
        <span style={{ color: `${p.paper}A0`, fontSize: 9.5, letterSpacing: "0.2em" }}>
          COLLECTION
        </span>
        <span style={{ color: p.paper, fontSize: 13, fontWeight: 400, letterSpacing: "0.32em" }}>
          MAISON
        </span>
        <span style={{ color: `${p.paper}A0`, fontSize: 9.5, letterSpacing: "0.2em" }}>
          ENQUIRE
        </span>
      </div>
      <div className="relative flex flex-col items-center px-10" style={{ marginTop: 46 }}>
        <div style={{ color: p.accent, fontSize: 9, letterSpacing: "0.34em" }}>AUTUMN MMXXVI</div>
        <div
          style={{
            color: p.paper,
            fontSize: 46,
            fontWeight: 300,
            lineHeight: 1.08,
            marginTop: 18,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Objects made
          <br />
          to be kept.
        </div>
        <div style={{ width: 26, height: 1, background: `${p.accent}`, margin: "26px 0" }} />
        <span style={{ color: `${p.paper}80`, fontSize: 10, letterSpacing: "0.24em" }}>
          DISCOVER THE COLLECTION
        </span>
      </div>
      <div
        className="absolute right-0 bottom-0 left-0"
        style={{ height: 66, background: `linear-gradient(to top, ${p.accent}22, transparent)` }}
      />
    </div>
  );
}

/* ---------- 11 · Real estate ---------- */

function RealEstateLayout({ p }: { p: Palette }) {
  return (
    <div className="h-full w-full" style={{ background: p.ink }}>
      <Nav
        p={p}
        brand="AURELIA RIDGE"
        items={["Project", "Plans", "Location"]}
        cta="Site visit"
        dark
      />
      <div className="relative px-9 pt-8">
        <div style={{ color: p.accent, fontSize: 9, letterSpacing: "0.24em", fontWeight: 600 }}>
          SARJAPUR RIDGE · BENGALURU
        </div>
        <div
          style={{
            color: p.paper,
            fontSize: 32,
            fontWeight: 300,
            lineHeight: 1.12,
            marginTop: 12,
            letterSpacing: "-0.03em",
          }}
        >
          Twelve residences.
          <br />
          One ridge.
        </div>
      </div>
      <div
        className="mx-9 mt-6 rounded"
        style={{
          height: 92,
          background: `linear-gradient(115deg, ${p.accent}44, ${p.paper}10)`,
          border: `1px solid ${p.paper}18`,
        }}
      />
      <div className="mt-5 grid grid-cols-4 gap-3 px-9">
        {[
          ["12", "Residences"],
          ["4.2", "Acres"],
          ["82%", "Open ground"],
          ["2027", "Handover"],
        ].map(([v, k]) => (
          <div
            key={k}
            className="rounded p-2.5"
            style={{ background: `${p.paper}0A`, border: `1px solid ${p.paper}14` }}
          >
            <div style={{ color: p.paper, fontSize: 16, fontWeight: 600 }}>{v}</div>
            <div
              style={{ color: `${p.paper}70`, fontSize: 8, letterSpacing: "0.1em", marginTop: 1 }}
            >
              {k!.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 12 · Immersive 3D ---------- */

function ImmersiveLayout({ p }: { p: Palette }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: p.ink }}>
      <Nav p={p} brand="AXIOM" items={["Explore", "Specs"]} cta="Configure" dark />
      <div className="relative flex h-[330px] items-center justify-center">
        {/* stage glow */}
        <div
          className="absolute"
          style={{
            width: 300,
            height: 300,
            borderRadius: 999,
            background: `radial-gradient(circle, ${p.accent}38, transparent 68%)`,
          }}
        />
        {/* orbit rings */}
        {[132, 168].map((r) => (
          <div
            key={r}
            className="absolute"
            style={{
              width: r * 2,
              height: r * 0.82,
              border: `1px solid ${p.accent}30`,
              borderRadius: 999,
              transform: "rotateX(0deg)",
            }}
          />
        ))}
        {/* the object */}
        <div
          style={{
            width: 116,
            height: 116,
            background: `linear-gradient(145deg, ${p.accent}, ${p.accent}55)`,
            borderRadius: 18,
            transform: "rotate(45deg)",
            boxShadow: `0 0 44px ${p.accent}55`,
          }}
        />
        {/* hotspots */}
        {[
          { top: 96, left: 214, n: "01", label: "Design" },
          { top: 176, left: 470, n: "02", label: "Performance" },
          { top: 246, left: 250, n: "03", label: "Technology" },
        ].map((h) => (
          <div
            key={h.n}
            className="absolute flex items-center gap-2"
            style={{ top: h.top, left: h.left }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: `${p.ink}D0`,
                border: `1px solid ${p.accent}`,
                color: p.accent,
                fontSize: 7.5,
                fontWeight: 700,
              }}
            >
              {h.n}
            </div>
            <span style={{ color: `${p.paper}B0`, fontSize: 9, letterSpacing: "0.1em" }}>
              {h.label}
            </span>
          </div>
        ))}
      </div>
      {/* controls */}
      <div className="absolute right-9 bottom-5 left-9 flex items-center justify-between">
        <div className="flex gap-2">
          {["Rotate", "Zoom", "Reset"].map((c) => (
            <span
              key={c}
              className="rounded"
              style={{
                color: `${p.paper}A0`,
                fontSize: 9,
                padding: "5px 10px",
                border: `1px solid ${p.paper}22`,
              }}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[p.accent, `${p.paper}90`, `${p.paper}40`].map((c, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 999, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
