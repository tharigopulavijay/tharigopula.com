import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { demoBrand, demoStats } from "@/data/demo-brand";

export const Route = createFileRoute("/demo/cinematic")({
  head: () => ({
    meta: [
      { title: "Aurelia Ridge — Cinematic Scroll Experience" },
      {
        name: "description",
        content:
          "Experience 04: an authored, cinematic scroll-driven story for Aurelia Ridge with pinned scenes, parallax depth and clip-path reveals.",
      },
      { property: "og:title", content: "Aurelia Ridge — Cinematic Scroll Experience" },
      {
        property: "og:description",
        content: "A pinned, scrubbed scroll story told in navy and electric blue for a hillside residential development.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CinematicDemo,
});

const scenes = [
  {
    id: "arrival",
    label: "01 — Arrival",
    heading: "The ridge waits above the city noise.",
    body: "Twelve residences, cut into a single hillside, facing the light.",
  },
  {
    id: "land",
    label: "02 — The Land",
    heading: "4.2 acres. 82% held open.",
    body: "Terraced ground, retaining walls, and a slope that decides everything.",
  },
  {
    id: "light",
    label: "03 — Orientation",
    heading: "Rotated fourteen degrees for north light.",
    body: "Every residence reads the sun before it reads the view.",
  },
  {
    id: "material",
    label: "04 — Material",
    heading: "Board-formed concrete. Local granite. Lime render.",
    body: "A palette chosen to age honestly across a generation.",
  },
  {
    id: "commons",
    label: "05 — The Commons",
    heading: "Shared gardens, a lap pool, a residents' pavilion.",
    body: "Private homes, held together by common ground.",
  },
  {
    id: "handover",
    label: "06 — 2027",
    heading: demoBrand.promise,
    body: "One ridge. Twelve residences. Built to last.",
  },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function CinematicDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [labelVisible, setLabelVisible] = useState(true);
  const [muted, setMuted] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const onFirstScroll = () => setLabelVisible(false);
    window.addEventListener("scroll", onFirstScroll, { once: true, passive: true });
    return () => window.removeEventListener("scroll", onFirstScroll);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    let ctx: { revert: () => void } | undefined;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      const root = containerRef.current;
      if (!root) return;

      ctx = gsap.context(() => {
        gsap.to(progressRef.current, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
          },
        });

        const sceneEls = gsap.utils.toArray<HTMLElement>(".cinema-scene");
        sceneEls.forEach((scene, index) => {
          const lines = scene.querySelectorAll(".cinema-line");
          const bg = scene.querySelector(".cinema-bg");
          const mask = scene.querySelector(".cinema-mask");

          ScrollTrigger.create({
            trigger: scene,
            start: "top center",
            end: "bottom center",
            onEnter: () => setSceneIndex(index),
            onEnterBack: () => setSceneIndex(index),
          });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: scene,
              start: "top bottom",
              end: "top top",
              scrub: true,
            },
          });

          if (bg) tl.fromTo(bg, { yPercent: 15 }, { yPercent: -15, ease: "none" }, 0);
          if (mask) {
            tl.fromTo(
              mask,
              { clipPath: "inset(0 0 100% 0)" },
              { clipPath: "inset(0 0 0% 0)", ease: "none" },
              0,
            );
          }

          gsap.fromTo(
            lines,
            { yPercent: 100, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              stagger: 0.12,
              ease: "power3.out",
              scrollTrigger: {
                trigger: scene,
                start: "top 70%",
                end: "top 30%",
                scrub: true,
              },
            },
          );
        }, root);
      }, root);
    })();

    return () => ctx?.revert();
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <main className="bg-ink text-ink-foreground">
        <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <span className="mb-6 text-xs uppercase tracking-widest text-azure">Cinematic Demo</span>
          <h1 className="max-w-3xl text-5xl font-bold leading-tight sm:text-6xl">{demoBrand.name}</h1>
          <p className="mt-6 max-w-xl text-ink-muted">{demoBrand.tagline}</p>
        </section>
        {scenes.map((scene) => (
          <section key={scene.id} className="border-t border-ink-border px-6 py-24 sm:px-16">
            <span className="text-xs uppercase tracking-widest text-azure">{scene.label}</span>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">{scene.heading}</h2>
            <p className="mt-4 max-w-xl text-ink-muted">{scene.body}</p>
          </section>
        ))}
        <section className="grid grid-cols-2 gap-8 border-t border-ink-border px-6 py-24 sm:grid-cols-4 sm:px-16">
          {demoStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl font-bold text-aqua">{stat.value}</div>
              <div className="mt-2 text-xs uppercase tracking-widest text-ink-muted">{stat.label}</div>
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main ref={containerRef} className="relative bg-ink text-ink-foreground">
      <div className="fixed left-0 top-0 z-40 h-1 w-full bg-ink-border">
        <div ref={progressRef} className="h-full origin-left scale-x-0 bg-aqua" />
      </div>

      <div className="fixed right-6 top-6 z-40 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-muted">
        <span>
          Scene {String(sceneIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
        </span>
        <button
          onClick={() => setMuted((v) => !v)}
          className="rounded-full border border-ink-border px-3 py-1 text-ink-foreground"
          aria-pressed={muted}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px circle at 50% 20%, rgba(61,156,255,0.25), transparent 60%), linear-gradient(180deg, #07182f 0%, #04101f 100%)",
          }}
        />
        <span
          className={`relative z-10 mb-8 text-xs uppercase tracking-[0.3em] text-azure transition-opacity duration-700 ${
            labelVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          Cinematic Demo — Scroll to Experience
        </span>
        <h1 className="relative z-10 max-w-5xl text-6xl font-bold leading-[0.95] sm:text-8xl">{demoBrand.name}</h1>
        <p className="relative z-10 mt-8 max-w-xl text-lg text-ink-muted">{demoBrand.tagline}</p>
      </section>

      {scenes.map((scene) => (
        <section
          key={scene.id}
          className="cinema-scene relative flex min-h-screen items-center overflow-hidden px-6 py-24 sm:px-16"
        >
          <div
            className="cinema-bg pointer-events-none absolute inset-[-10%]"
            aria-hidden
            style={{
              background:
                "linear-gradient(135deg, rgba(23,105,255,0.18), transparent 55%), linear-gradient(315deg, rgba(65,230,208,0.12), transparent 60%)",
            }}
          />
          <div className="relative z-10 grid w-full gap-10 lg:grid-cols-[1fr,0.8fr] lg:items-center">
            <div className="overflow-hidden">
              <span className="cinema-line block text-xs uppercase tracking-[0.3em] text-azure">{scene.label}</span>
              <h2 className="cinema-line mt-6 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
                {scene.heading}
              </h2>
              <p className="cinema-line mt-6 max-w-md text-ink-muted">{scene.body}</p>
            </div>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-ink-border bg-ink/40">
              <div
                className="cinema-mask absolute inset-0"
                style={{
                  background:
                    "linear-gradient(160deg, #1769ff 0%, #0b2a55 45%, #07182f 100%)",
                  clipPath: "inset(0 0 100% 0)",
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 24px)",
                }}
              />
            </div>
          </div>
        </section>
      ))}

      <section className="relative flex min-h-[70vh] flex-col items-center justify-center gap-12 px-6 text-center">
        <h2 className="max-w-3xl text-4xl font-semibold sm:text-5xl">{demoBrand.promise}</h2>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {demoStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-aqua">{stat.value}</div>
              <div className="mt-2 text-xs uppercase tracking-widest text-ink-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
