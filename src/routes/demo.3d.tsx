import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useProgress } from "@react-three/drei";
import { demoBrand } from "@/data/demo-brand";
import type { Hotspot, SceneApi } from "@/components/demo/ThreeDScene";

export const Route = createFileRoute("/demo/3d")({
  head: () => ({
    meta: [
      { title: "3D Experience | Aurelia Ridge" },
      {
        name: "description",
        content:
          "Explore an interactive 3D walkthrough of the Aurelia Ridge pavilion — a stylised hillside residence rendered entirely in three.js.",
      },
      { property: "og:title", content: "3D Experience | Aurelia Ridge" },
      {
        property: "og:description",
        content: "Rotate, zoom and explore the Aurelia Ridge pavilion in an interactive 3D scene.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Demo3DPage,
});

const LazyThreeDScene = React.lazy(() => import("@/components/demo/ThreeDScene"));

const FINISHES = [
  { id: "limewash", label: "Lime render", color: "#e9e2d4" },
  { id: "granite", label: "Local granite", color: "#8a8478" },
  { id: "concrete", label: "Board-formed concrete", color: "#b9b7b0" },
] as const;

function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function ProgressLoader() {
  const { progress } = useProgress();
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-border bg-ink/90 px-6 py-5 text-ink-foreground">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-200"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
        <p className="font-mono text-xs tracking-widest text-ink-muted">
          LOADING {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}

function Poster({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="relative flex h-[70svh] min-h-[420px] w-full items-center justify-center overflow-hidden rounded-3xl border border-ink-border bg-gradient-to-br from-[#0b2a55] via-[#123869] to-[#1769ff]">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,#ffffff33,transparent_45%),radial-gradient(circle_at_80%_75%,#41e6d033,transparent_45%)]" />
      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <span className="eyebrow text-ink-foreground/70">Interactive 3D</span>
        <h1 className="max-w-md font-display text-3xl font-semibold text-ink-foreground sm:text-4xl">
          Walk the {demoBrand.name} pavilion
        </h1>
        <p className="max-w-sm text-sm text-ink-foreground/80">
          A stylised, fully three.js render of the residents&apos; pavilion — rotate, zoom and explore
          design, performance and technology highlights.
        </p>
        <button
          type="button"
          onClick={onLaunch}
          className="rounded-full bg-signal px-6 py-3 text-sm font-medium text-signal-foreground shadow-lift transition-transform hover:scale-[1.03]"
        >
          Launch 3D experience
        </button>
      </div>
    </div>
  );
}

function FallbackCard() {
  return (
    <div className="flex h-[70svh] min-h-[420px] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-ink-border bg-ink px-6 text-center text-ink-foreground">
      <span className="eyebrow text-ink-muted">3D unavailable</span>
      <h1 className="font-display text-2xl font-semibold">{demoBrand.name}</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        Your browser or device doesn&apos;t support WebGL, so the interactive 3D experience can&apos;t
        run here. {demoBrand.promise}
      </p>
    </div>
  );
}

function Demo3DPage() {
  const [webglOk, setWebglOk] = React.useState<boolean | null>(null);
  const [launched, setLaunched] = React.useState(false);
  const [hotspot, setHotspot] = React.useState<Hotspot | null>(null);
  const [facadeColor, setFacadeColor] = React.useState<string>(FINISHES[0].color);
  const [quality, setQuality] = React.useState<"high" | "low">("high");
  const [playAnimation, setPlayAnimation] = React.useState(true);
  const apiRef = React.useRef<SceneApi | null>(null);

  React.useEffect(() => {
    setWebglOk(supportsWebGL());
  }, []);

  if (webglOk === false) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <FallbackCard />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <header className="mb-6">
        <span className="eyebrow text-muted-foreground">Experience Lab</span>
        <h1 className="mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
          {demoBrand.name} — 3D pavilion
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{demoBrand.tagline}</p>
      </header>

      {!launched ? (
        <Poster onLaunch={() => setLaunched(true)} />
      ) : (
        <ClientOnly fallback={<Poster onLaunch={() => setLaunched(true)} />}>
          <div className="flex flex-col gap-4">
            <div className="relative h-[70svh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-ink-border bg-[#eef2f7]">
              <React.Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-border bg-ink/90 px-6 py-5 text-ink-foreground">
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-1/4 animate-pulse rounded-full bg-signal" />
                      </div>
                      <p className="font-mono text-xs tracking-widest text-ink-muted">LOADING SCENE…</p>
                    </div>
                  </div>
                }
              >
                <LazyThreeDScene
                  onHotspotSelect={setHotspot}
                  facadeColor={facadeColor}
                  quality={quality}
                  playAnimation={playAnimation}
                  apiRef={apiRef}
                />
                <ProgressLoader />
              </React.Suspense>

              {hotspot && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 sm:justify-start sm:pl-6">
                  <div className="pointer-events-auto w-full max-w-xs rounded-2xl border border-ink-border bg-ink/95 p-4 text-ink-foreground shadow-plate">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display text-base font-semibold">{hotspot.title}</h2>
                      <button
                        type="button"
                        onClick={() => setHotspot(null)}
                        className="text-ink-muted hover:text-ink-foreground"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{hotspot.body}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => apiRef.current?.resetView()}
                className="rounded-full border border-ink-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Reset view
              </button>
              <button
                type="button"
                onClick={() => apiRef.current?.setAngle("front")}
                className="rounded-full border border-ink-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => apiRef.current?.setAngle("top")}
                className="rounded-full border border-ink-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => apiRef.current?.setAngle("corner")}
                className="rounded-full border border-ink-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Corner
              </button>
              <button
                type="button"
                onClick={() => setPlayAnimation((p) => !p)}
                className={`rounded-full border px-4 py-2 text-xs font-medium ${
                  playAnimation
                    ? "border-signal bg-signal text-signal-foreground"
                    : "border-ink-border bg-card text-foreground hover:bg-accent"
                }`}
              >
                {playAnimation ? "Animation: on" : "Play animation"}
              </button>
              <button
                type="button"
                onClick={() => setQuality((q) => (q === "high" ? "low" : "high"))}
                className="rounded-full border border-ink-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Quality: {quality}
              </button>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Finish:</span>
                {FINISHES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFacadeColor(f.color)}
                    title={f.label}
                    aria-label={f.label}
                    className={`h-6 w-6 rounded-full border-2 ${
                      facadeColor === f.color ? "border-signal" : "border-ink-border"
                    }`}
                    style={{ backgroundColor: f.color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </ClientOnly>
      )}
    </div>
  );
}

