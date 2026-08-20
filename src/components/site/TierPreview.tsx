/**
 * Five miniature websites, one per experience tier.
 *
 * The tier names are the hardest thing on the site to explain in words —
 * "Dynamic" and "Interactive" mean nothing to someone buying their first
 * website. These escalate visibly: more content, then depth and motion cues,
 * then a dark cinematic treatment, then a dimensional one. A reader can rank
 * them at a glance without reading a single feature list.
 *
 * Each carries a small phone alongside, because every tier is responsive and
 * the mobile view is what most of their visitors will actually see.
 */

type Level = "essential" | "dynamic" | "interactive" | "cinematic" | "3d";

const COPY: Record<Level, { head: string; sub: string; cta: string }> = {
  essential: { head: "Build your business online with confidence.", sub: "", cta: "Contact us" },
  dynamic: { head: "Solutions that drive real results.", sub: "", cta: "Get started" },
  interactive: { head: "Engage. Convert. Grow.", sub: "", cta: "Explore solutions" },
  cinematic: { head: "Stories that inspire. Brands that lead.", sub: "", cta: "Play showreel" },
  "3d": { head: "Immersive experiences that set you apart.", sub: "", cta: "Explore" },
};

export function TierPreview({ level }: { level: Level }) {
  const dark = level === "cinematic" || level === "3d";
  const copy = COPY[level];

  return (
    <div className="relative" role="img" aria-label={`Preview of a ${level} website`}>
      {/* Browser */}
      <div className="overflow-hidden rounded-lg border border-[#DCE5F2] bg-white shadow-sm dark:border-[#22314A]">
        <div className="flex items-center gap-1 border-b border-[#E9EEF6] bg-[#F6F9FD] px-2 py-1.5 dark:border-[#22314A] dark:bg-[#16233A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F87171]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
          <div className="ml-2 flex flex-1 justify-end gap-2">
            {["Home", "About", "Services", "Contact"].map((l) => (
              <span key={l} className="text-[5px] text-[#8494AB]">
                {l}
              </span>
            ))}
          </div>
        </div>

        <div className="relative h-[112px] overflow-hidden">
          <Backdrop level={level} />
          <div className="absolute inset-0 p-2.5">
            <p
              className={`max-w-[62%] text-[9px] leading-tight font-semibold ${
                dark ? "text-white" : "text-[#0B1524]"
              }`}
            >
              {copy.head}
            </p>
            <span
              className="mt-1.5 inline-block rounded px-1.5 py-[3px] text-[5.5px] font-semibold text-white"
              style={{ background: ACCENT[level] }}
            >
              {copy.cta}
            </span>
          </div>
        </div>
      </div>

      {/* Phone, overlapping the browser's bottom-right corner. */}
      <div className="absolute -right-1 -bottom-3 w-[52px] overflow-hidden rounded-[7px] border-[2.5px] border-[#16202F] bg-white shadow-lift">
        <div className="relative h-[76px] overflow-hidden">
          <Backdrop level={level} />
          <span
            aria-hidden
            className="absolute top-0 left-1/2 h-[5px] w-[38%] -translate-x-1/2 rounded-b-md bg-[#16202F]"
          />
          <p
            className={`absolute inset-x-0 bottom-1.5 px-1.5 text-[5px] leading-tight font-semibold ${
              dark ? "text-white" : "text-[#0B1524]"
            }`}
          >
            {copy.head}
          </p>
        </div>
      </div>
    </div>
  );
}

const ACCENT: Record<Level, string> = {
  essential: "#2563EB",
  dynamic: "#0EA36B",
  interactive: "#7C4DDA",
  cinematic: "#E08411",
  "3d": "#2563EB",
};

/**
 * The escalation lives here. Each backdrop adds something the one before it
 * does not have — content density, then depth, then atmosphere, then dimension.
 */
function Backdrop({ level }: { level: Level }) {
  if (level === "essential") {
    return (
      <div className="absolute inset-0 bg-[#F7F9FC]">
        <Building tone="#D8E3F2" x={62} />
      </div>
    );
  }

  if (level === "dynamic") {
    return (
      <div className="absolute inset-0 bg-[#F4F8FD]">
        <Building tone="#C3D6EE" x={58} />
        {/* More content blocks — a site with things to say. */}
        <div className="absolute right-2 bottom-2 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-4 w-6 rounded-sm bg-white shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (level === "interactive") {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-[#F3F1FD] to-[#EAF1FE]">
        <Building tone="#CBD3F0" x={60} />
        {/* Interaction cues: an orbit and a cursor. */}
        <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full" aria-hidden>
          <ellipse
            cx="150"
            cy="58"
            rx="34"
            ry="34"
            fill="none"
            stroke="#7C4DDA"
            strokeWidth="0.8"
            opacity="0.45"
          />
          <ellipse
            cx="150"
            cy="58"
            rx="22"
            ry="22"
            fill="none"
            stroke="#7C4DDA"
            strokeWidth="0.8"
            opacity="0.3"
          />
          <circle cx="150" cy="24" r="2.6" fill="#7C4DDA" />
          <path d="M126 74l9 20 3-8 8-2z" fill="#7C4DDA" />
        </svg>
      </div>
    );
  }

  if (level === "cinematic") {
    return (
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, #0E1728 0%, #1B2B45 55%, #2C4468 100%)" }}
      >
        {/* A lit building at dusk, plus a warm key light — the tier is about
            atmosphere, so the miniature has to have some. */}
        <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="cine-key" cx="78%" cy="24%" r="62%">
              <stop offset="0%" stopColor="#E08411" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#E08411" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="112" fill="url(#cine-key)" />
          <rect x="112" y="40" width="42" height="72" fill="#16253E" />
          <rect x="156" y="58" width="26" height="54" fill="#101C31" />
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 4 }).map((__, c) => (
              <rect
                key={`${r}-${c}`}
                x={118 + c * 9}
                y={47 + r * 12}
                width="5"
                height="7"
                fill="#FFC978"
                opacity={(r + c) % 3 === 0 ? 0.9 : 0.35}
              />
            )),
          )}
          <rect x="0" y="96" width="200" height="16" fill="#080F1C" opacity="0.85" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0"
      style={{ background: "linear-gradient(155deg, #16233C 0%, #24406B 60%, #35608F 100%)" }}
    >
      <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M118 88V44l30-14 30 14v44Z" fill="#4E7CB0" opacity="0.85" />
        <path d="M118 44l30-14v58l-30-0Z" fill="#6D9BD1" opacity="0.6" />
        <path d="M148 30l30 14v44l-30 0Z" fill="#2E5D9E" opacity="0.9" />
      </svg>
    </div>
  );
}

/** A simple massed building, reused across the lighter tiers. */
function Building({ tone, x }: { tone: string; x: number }) {
  return (
    <svg viewBox="0 0 200 112" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect x={x + 46} y="34" width="34" height="78" fill={tone} />
      <rect x={x + 20} y="52" width="24" height="60" fill={tone} opacity="0.75" />
      <rect x={x + 82} y="60" width="20" height="52" fill={tone} opacity="0.6" />
      {Array.from({ length: 5 }).map((_, r) =>
        Array.from({ length: 3 }).map((__, c) => (
          <rect
            key={`${r}-${c}`}
            x={x + 52 + c * 9}
            y={42 + r * 11}
            width="5"
            height="6"
            fill="#fff"
            opacity="0.75"
          />
        )),
      )}
    </svg>
  );
}
