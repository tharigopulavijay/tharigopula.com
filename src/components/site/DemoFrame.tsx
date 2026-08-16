import { useEffect, useRef, useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink, RotateCw, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const devices = {
  desktop: { label: "Desktop", width: 1440, icon: Monitor },
  tablet: { label: "Tablet", width: 834, icon: Tablet },
  mobile: { label: "Mobile", width: 390, icon: Smartphone },
} as const;

type DeviceKey = keyof typeof devices;

export function DemoFrame({
  src,
  title,
  heavy = false,
  height = 620,
}: {
  src: string;
  title: string;
  heavy?: boolean;
  height?: number;
}) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [loaded, setLoaded] = useState(!heavy);
  const [nonce, setNonce] = useState(0);
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
    setLoaded(!heavy);
    setReady(false);
  }, [src, heavy]);

  const frameWidth = devices[device].width;
  const scale = shellWidth > 0 ? Math.min(1, shellWidth / frameWidth) : 1;

  return (
    <div className="overflow-hidden rounded-xl border border-ink-border bg-ink">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-border px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-muted/40" />
        </div>
        <p className="flex-1 truncate rounded-md bg-white/5 px-3 py-1 font-mono text-[11px] text-ink-muted">
          aureliaridge.example{src.replace("/demo", "")}
        </p>
        <div className="flex items-center gap-1 rounded-md bg-white/5 p-1">
          {(Object.keys(devices) as DeviceKey[]).map((key) => {
            const Icon = devices[key].icon;
            return (
              <button
                key={key}
                type="button"
                aria-label={devices[key].label}
                aria-pressed={device === key}
                onClick={() => setDevice(key)}
                className={cn(
                  "rounded p-1.5 transition-colors",
                  device === key ? "bg-signal text-signal-foreground" : "text-ink-muted hover:text-ink-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setReady(false);
            setNonce((n) => n + 1);
          }}
          aria-label="Reload demo"
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:text-ink-foreground"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-border px-3 py-1.5 text-xs font-medium text-ink-foreground transition-colors hover:border-signal"
        >
          Open full <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div ref={shellRef} className="relative overflow-hidden bg-ink" style={{ height }}>
        {loaded ? (
          <>
            {!ready ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-xs tracking-[0.18em] text-ink-muted uppercase">Loading experience…</p>
              </div>
            ) : null}
            <iframe
              key={`${src}-${nonce}`}
              src={src}
              title={title}
              loading="lazy"
              onLoad={() => setReady(true)}
              className={cn(
                "origin-top-left border-0 bg-background transition-opacity duration-500",
                ready ? "opacity-100" : "opacity-0",
              )}
              style={{
                width: frameWidth,
                height: height / scale,
                transform: `scale(${scale})`,
              }}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-sm text-sm text-ink-muted">
              This experience is heavier than the rest. It loads only when you ask for it, so the page you are on stays
              fast.
            </p>
            <button
              type="button"
              onClick={() => setLoaded(true)}
              className="inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-signal-foreground transition-transform hover:scale-[1.02]"
            >
              <Play className="h-4 w-4" /> Load live demo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
