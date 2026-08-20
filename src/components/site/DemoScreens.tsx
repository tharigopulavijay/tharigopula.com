/**
 * The screens that go inside the device frames.
 *
 * Drawn rather than screenshotted: a screenshot of the real platform demo
 * would be a 200KB image that goes stale the moment that demo changes, and
 * would blur at the sizes these are used at. These stay sharp at any scale and
 * cost nothing to load.
 *
 * They keep their own light surface in both site themes, because a screen
 * inside a depicted laptop is part of the depicted object, not part of the page.
 */

const SIDEBAR = [
  "Dashboard",
  "Leads",
  "Orders",
  "Inventory",
  "Customers",
  "Invoices",
  "Services",
  "Reports",
];

const STATS: [string, string, string][] = [
  ["Total revenue", "₹8,45,000", "+24%"],
  ["Total orders", "320", "+16%"],
  ["Active customers", "1,245", "+11%"],
  ["Conversion rate", "24.5%", "+6%"],
];

const ORDERS: [string, string, string][] = [
  ["ORD-1048", "Ramesh Industries", "₹2,40,000"],
  ["ORD-1047", "Latha Textiles", "₹1,55,000"],
  ["ORD-1046", "Sri Sai Enterprises", "₹95,000"],
  ["ORD-1045", "Techno Solutions", "₹78,500"],
];

/** An operations dashboard — the business software demo, in miniature. */
export function DashboardScreen({ compact }: { compact?: boolean | undefined } = {}) {
  const modules = compact ? SIDEBAR.slice(0, 7) : SIDEBAR;

  return (
    <div
      role="img"
      aria-label="An operations dashboard showing revenue, orders, a sales chart and recent orders"
      className="flex h-full text-[#0B1524]"
    >
      <div className="flex w-[19%] shrink-0 flex-col gap-1 p-2" style={{ background: "#0B1B33" }}>
        <div className="mb-1.5 flex items-center gap-1 px-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#4D93FF]" />
          <span className="text-[6px] font-bold tracking-wide text-white">THARIGOPULA</span>
        </div>
        {modules.map((m, i) => (
          <div
            key={m}
            className="rounded px-1.5 py-1 text-[6.5px] font-medium"
            style={{
              background: i === 0 ? "#1D4ED8" : "transparent",
              color: i === 0 ? "#fff" : "#8FA9CE",
            }}
          >
            {m}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden bg-[#F4F7FC] p-2">
        <p className="text-[8px] font-bold">Dashboard</p>

        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {STATS.map(([label, value, delta]) => (
            <div key={label} className="rounded bg-white p-1.5">
              <p className="text-[5px] text-[#7C8AA0]">{label}</p>
              <p className="mt-0.5 text-[8px] font-bold">{value}</p>
              <p className="text-[5px] font-semibold text-[#0B7A4B]">▲ {delta}</p>
            </div>
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-[1.55fr_1fr] gap-1">
          <div className="rounded bg-white p-1.5">
            <p className="text-[5.5px] font-semibold text-[#7C8AA0]">Sales overview</p>
            <svg viewBox="0 0 200 54" className="mt-1 w-full" aria-hidden>
              <polygon
                points="0,44 25,36 50,40 75,22 100,28 125,14 150,20 175,8 200,12 200,54 0,54"
                fill="#2563EB"
                opacity="0.1"
              />
              <polyline
                points="0,44 25,36 50,40 75,22 100,28 125,14 150,20 175,8 200,12"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="rounded bg-white p-1.5">
            <p className="text-[5.5px] font-semibold text-[#7C8AA0]">Top products</p>
            <div className="mt-1 flex items-center justify-center">
              <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden>
                <circle cx="21" cy="21" r="15" fill="none" stroke="#E4EAF2" strokeWidth="7" />
                <circle
                  cx="21"
                  cy="21"
                  r="15"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="7"
                  strokeDasharray="38 94"
                  transform="rotate(-90 21 21)"
                />
                <circle
                  cx="21"
                  cy="21"
                  r="15"
                  fill="none"
                  stroke="#41E6D0"
                  strokeWidth="7"
                  strokeDasharray="26 106"
                  strokeDashoffset="-38"
                  transform="rotate(-90 21 21)"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-1.5 rounded bg-white p-1.5">
          <p className="text-[5.5px] font-semibold text-[#7C8AA0]">Recent orders</p>
          <div className="mt-1 flex flex-col gap-[3px]">
            {ORDERS.map(([ref, name, amt]) => (
              <div key={ref} className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-[#0EA36B]" />
                  <span className="font-mono text-[5px] text-[#7C8AA0]">{ref}</span>
                  <span className="text-[5.5px] font-medium">{name}</span>
                </span>
                <span className="text-[5.5px] font-bold">{amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A property website, standing in for the website tier demos. */
export function WebsiteScreen() {
  return (
    <div
      role="img"
      aria-label="A property website showing a hillside hero and three featured listings"
      className="flex h-full flex-col bg-white text-[#0B1524]"
    >
      <div className="flex items-center justify-between border-b border-[#E9EEF6] px-3 py-2">
        <span className="text-[8px] font-bold tracking-tight">Aurelia Ridge</span>
        <div className="flex gap-2">
          {["Homes", "Plans", "About", "Visit"].map((l) => (
            <span key={l} className="text-[6px] text-[#5B6B82]">
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(155deg, #1B3358 0%, #274A78 42%, #3E6FA5 72%, #6D9BD1 100%)",
          }}
        />
        {/* A drawn hillside, so the hero reads as a place rather than a swatch. */}
        <svg
          viewBox="0 0 420 200"
          className="absolute inset-x-0 bottom-0 w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0 148 90 96 168 132 250 78 330 118 420 84v116H0Z"
            fill="#12233C"
            opacity="0.55"
          />
          <path
            d="M0 172 78 138 160 164 244 126 332 156 420 132v68H0Z"
            fill="#0B1524"
            opacity="0.75"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-[11px] leading-tight font-semibold text-white">
            Find spaces that
            <br />
            inspire your life.
          </p>
          <p className="mt-1 text-[6.5px] text-white/70">
            Modern homes. Prime locations. Endless possibilities.
          </p>
          <span className="mt-1.5 inline-block rounded bg-[#4D93FF] px-2 py-1 text-[6px] font-semibold text-white">
            Explore properties
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-2">
        {[
          ["Premium Villa", "₹1.8 Cr"],
          ["Luxury Apartment", "₹95 L"],
          ["Modern Duplex", "₹1.2 Cr"],
        ].map(([name, price]) => (
          <div key={name} className="overflow-hidden rounded border border-[#E9EEF6]">
            <div
              className="h-8"
              style={{ background: "linear-gradient(150deg, #9DC4F5, #4E7CB0)" }}
            />
            <div className="p-1">
              <p className="truncate text-[5.5px] font-semibold">{name}</p>
              <p className="text-[5.5px] font-bold text-[#2563EB]">{price}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
