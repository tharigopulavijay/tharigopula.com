import { Laptop, Phone, Tablet } from "./DeviceFrames";
import { MobileAppDemo } from "./MobileAppDemo";
import { presetById } from "@/data/demo-apps";
import { DashboardScreen, WebsiteScreen } from "./DemoScreens";

/**
 * The multi-product composition at the top of the Live Demos gateway.
 *
 * Four things are being sold on this page and a single screenshot can only
 * carry one of them, so all three device classes appear at once. The phone runs
 * the real app component rather than a static picture, which keeps it honest
 * and costs nothing extra to maintain.
 *
 * The whole composition is inert: at 0.6 scale its tap targets are about 14px,
 * too small to actually use, and leaving focusable controls inside a decorative
 * hero means a keyboard user tabs through a toy phone before reaching the real
 * links. The working version is one click away on each category page.
 *
 * Overlaps at lg and above; stacks to a simple row below, where absolute
 * positioning would collapse into a pile.
 */
export function LiveDemoHero() {
  return (
    <div className="relative" inert>
      {/* Large screens: the overlapped composition. */}
      <div className="relative hidden h-[500px] lg:block">
        <div className="absolute top-0 left-[12%] z-10">
          <Laptop scale={0.8}>
            <DashboardScreen compact />
          </Laptop>
        </div>

        <div className="absolute top-[96px] left-0 z-20">
          <Phone scale={0.6}>
            <MobileAppDemo preset={presetById("ordering")} />
          </Phone>
        </div>

        <div className="absolute top-[168px] right-0 z-30">
          <Tablet scale={0.52}>
            <WebsiteScreen />
          </Tablet>
        </div>

        <FloatLabel className="top-[64px] left-[4%]" icon={<PhoneIcon />} label="Mobile Apps" />
        <FloatLabel
          className="top-[128px] right-[30%]"
          icon={<GlobeIcon />}
          label="Website Demos"
        />
        <FloatLabel
          className="bottom-[52px] left-[24%]"
          icon={<GridIcon />}
          label="Business Software"
        />
        <FloatLabel className="right-[2%] bottom-[6px]" icon={<BoltIcon />} label="Automation" />
      </div>

      {/* Below lg: phone and tablet side by side, laptop dropped rather than shrunk
          into illegibility. */}
      <div className="flex items-start justify-center gap-4 lg:hidden">
        <Phone scale={0.55}>
          <MobileAppDemo preset={presetById("ordering")} />
        </Phone>
        <div className="hidden sm:block">
          <Tablet scale={0.5}>
            <WebsiteScreen />
          </Tablet>
        </div>
      </div>
    </div>
  );
}

function FloatLabel({
  className,
  icon,
  label,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className={`absolute z-40 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lift ${className}`}
    >
      <span className="text-signal" aria-hidden>
        {icon}
      </span>
      <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
    </div>
  );
}

/* ---------- icons ---------- */

const stroke = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PhoneIcon() {
  return (
    <svg {...stroke}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15 0 18-2.5-3-2.5-15.4 0-18Z" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg {...stroke}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg {...stroke}>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  );
}
