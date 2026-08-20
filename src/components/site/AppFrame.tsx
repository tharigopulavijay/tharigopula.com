import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Embeds a desktop business application at its real width, scaled to fit.
 *
 * Deliberately not DemoFrame: that one puts a fake website address in its
 * chrome and offers phone and tablet switches, which are the right controls for
 * a marketing site and the wrong ones for an operations system. This one says
 * plainly that the app is built for a desktop and gives a full-screen link,
 * rather than pretending a CRM is a responsive brochure.
 *
 * The iframe renders at `appWidth` and is transform-scaled, so the app never
 * reflows into a layout it was not designed for — it simply gets smaller.
 */
export function AppFrame({
  src,
  title,
  appWidth = 1440,
  appHeight = 900,
  label,
}: {
  src: string;
  title: string;
  appWidth?: number | undefined;
  appHeight?: number | undefined;
  /** Shown in the frame's chrome, in place of a URL bar. */
  label: string;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellWidth, setShellWidth] = useState(0);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setShellWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = shellWidth > 0 ? Math.min(1, shellWidth / appWidth) : 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-border px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted/40" />
        </div>
        <p className="flex-1 truncate rounded-md bg-white/5 px-3 py-1 font-mono text-[11px] text-ink-muted">
          {label}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onClick={() => track({ name: "demo_opened", demo: "business-os-fullscreen" })}
          className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-ink-foreground transition-colors hover:bg-white/20"
        >
          Open full screen ↗
        </a>
      </div>

      <div ref={shellRef} className="relative w-full overflow-hidden">
        <div style={{ height: appHeight * scale }}>
          <iframe
            src={src}
            title={title}
            loading="lazy"
            className="border-0 bg-white"
            style={{
              width: appWidth,
              height: appHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    </div>
  );
}
