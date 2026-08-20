import { Icons } from "./HomeGrids";

/**
 * A stylised skyline with industry marks arcing toward it.
 *
 * The reference design used a photorealistic building render. Drawn geometry is
 * used here instead — it stays sharp at any size, weighs nothing, follows the
 * theme and cannot look like the stock photography every competitor uses. A
 * deliberately flat illustration reads as a choice; an imitation of a 3D render
 * drawn in CSS would not.
 *
 * If a real render is ever produced, it drops straight in behind the same chips.
 */

type Mark = {
  key: string;
  icon: React.ReactNode;
  color: string;
  /** Percentage position within the frame. */
  top: string;
  left?: string;
  right?: string;
};

const MARKS: Mark[] = [
  { key: "data", icon: <Icons.reporting />, color: "#2563EB", top: "6%", left: "38%" },
  { key: "clinic", icon: <Icons.clinic />, color: "#E0484D", top: "18%", right: "6%" },
  { key: "pro", icon: <Icons.professional />, color: "#2563EB", top: "34%", left: "4%" },
  { key: "factory", icon: <Icons.factory />, color: "#E08411", top: "46%", right: "10%" },
  { key: "retail", icon: <Icons.retail />, color: "#2563EB", top: "58%", left: "12%" },
  { key: "estate", icon: <Icons.realEstate />, color: "#0EA36B", top: "66%", right: "2%" },
];

export function IndustrySkyline() {
  return (
    <div className="relative w-full" aria-hidden>
      <svg viewBox="0 0 640 440" className="w-full" role="presentation">
        <defs>
          <linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BFD8F5" />
            <stop offset="55%" stopColor="#8FB6E4" />
            <stop offset="100%" stopColor="#6D9BD1" />
          </linearGradient>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D7E5F6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D7E5F6" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CBDCF1" stopOpacity="0" />
            <stop offset="50%" stopColor="#CBDCF1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#CBDCF1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Distant skyline, deliberately faint so the marks stay legible. */}
        {[
          [40, 250, 46, 150],
          [96, 220, 38, 180],
          [148, 268, 42, 132],
          [196, 236, 34, 164],
          [452, 244, 40, 156],
          [500, 214, 36, 186],
          [548, 258, 44, 142],
          [600, 232, 32, 168],
        ].map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="3" fill="url(#fade)" />
        ))}

        {/* The tower in front. */}
        <g>
          <rect x="252" y="118" width="136" height="282" rx="6" fill="url(#tower)" />
          <rect
            x="252"
            y="118"
            width="136"
            height="282"
            rx="6"
            fill="none"
            stroke="#5B87BC"
            strokeOpacity="0.4"
          />
          {/* window grid */}
          {Array.from({ length: 11 }).map((_, r) =>
            Array.from({ length: 4 }).map((__, c) => (
              <rect
                key={`w-${r}-${c}`}
                x={266 + c * 30}
                y={134 + r * 24}
                width="18"
                height="14"
                rx="1.5"
                fill="#FFFFFF"
                opacity={(r * 4 + c) % 5 === 0 ? 0.75 : 0.32}
              />
            )),
          )}
          {/* stepped crown */}
          <rect x="278" y="98" width="84" height="22" rx="4" fill="url(#tower)" />
          <rect x="302" y="82" width="36" height="18" rx="3" fill="url(#tower)" />
        </g>

        {/* Podium and ground line. */}
        <rect x="222" y="368" width="196" height="32" rx="4" fill="#B9D0EA" opacity="0.8" />
        <rect x="60" y="398" width="520" height="4" rx="2" fill="url(#ground)" />

        {/* Arcs from the marks toward the tower. */}
        <g
          fill="none"
          stroke="#8FB0D6"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        >
          <path d="M250 44 C 200 110, 210 170, 268 190" />
          <path d="M596 96 C 520 130, 470 150, 400 176" />
          <path d="M52 168 C 130 176, 190 190, 250 214" />
          <path d="M574 214 C 500 226, 450 234, 396 244" />
          <path d="M104 274 C 160 274, 210 280, 250 292" />
          <path d="M614 300 C 530 306, 460 316, 400 326" />
        </g>
      </svg>

      {/* Industry marks, positioned over the drawing. */}
      {MARKS.map((m) => (
        <span
          key={m.key}
          className="absolute grid h-11 w-11 place-items-center rounded-xl border border-border bg-card shadow-sm"
          style={{
            top: m.top,
            ...(m.left ? { left: m.left } : {}),
            ...(m.right ? { right: m.right } : {}),
            color: m.color,
          }}
        >
          {m.icon}
        </span>
      ))}
    </div>
  );
}
