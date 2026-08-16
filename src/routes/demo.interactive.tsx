import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { demoBrand, demoServices, demoStats, demoUnits } from "@/data/demo-brand";

export const Route = createFileRoute("/demo/interactive")({
  head: () => ({
    meta: [
      { title: "Aurelia Ridge — Interactive Experience Demo" },
      {
        name: "description",
        content:
          "Experience 03: a premium interactive site for Aurelia Ridge with cursor-responsive motion, magnetic buttons, 3D-tilt cards and live plan exploration.",
      },
      { property: "og:title", content: "Aurelia Ridge — Interactive Experience Demo" },
      {
        property: "og:description",
        content: "A cursor-responsive, tilt-and-reveal interactive experience for a hillside residential development.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InteractiveDemo,
});

function useHoverCapable() {
  const [hoverCapable, setHoverCapable] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const hoverMq = window.matchMedia("(hover: hover)");
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateHover = () => setHoverCapable(hoverMq.matches);
    const updateMotion = () => setReducedMotion(motionMq.matches);
    updateHover();
    updateMotion();
    hoverMq.addEventListener("change", updateHover);
    motionMq.addEventListener("change", updateMotion);
    return () => {
      hoverMq.removeEventListener("change", updateHover);
      motionMq.removeEventListener("change", updateMotion);
    };
  }, []);

  return { hoverCapable, reducedMotion };
}

function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { hoverCapable, reducedMotion } = useHoverCapable();

  useEffect(() => {
    const el = ref.current;
    if (!el || !hoverCapable || reducedMotion) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
    };
    const handleLeave = () => {
      el.style.transform = "translate(0, 0)";
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [hoverCapable, reducedMotion]);

  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-full bg-signal px-8 py-4 text-sm font-semibold uppercase tracking-wide text-signal-foreground transition-transform duration-300 ease-out ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function TiltCard({ title, body }: { title: string; body: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { hoverCapable, reducedMotion } = useHoverCapable();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hoverCapable || reducedMotion) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${py * -10}deg) rotateY(${px * 10}deg) scale3d(1.02,1.02,1.02)`;
    };
    const handleLeave = () => {
      el.style.transform = "perspective(900px) rotateX(0) rotateY(0) scale3d(1,1,1)";
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [hoverCapable, reducedMotion]);

  return (
    <div
      ref={ref}
      onClick={() => setActive((v) => !v)}
      className={`rounded-2xl border border-ink-border bg-ink/60 p-8 shadow-lg transition-[transform,background-color] duration-300 will-change-transform ${
        active ? "bg-ink" : ""
      }`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <h3 className="text-xl font-semibold text-ink-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function CountingStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useHoverCapable();

  useEffect(() => {
    const numeric = parseFloat(value.replace(/[^\d.]/g, ""));
    const suffix = value.replace(/[\d.]/g, "");
    const el = ref.current;
    const wrapper = wrapperRef.current;
    if (!el || !wrapper) return;

    if (reducedMotion || Number.isNaN(numeric)) {
      el.textContent = value;
      return;
    }

    let animated = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            const duration = 1200;
            const start = performance.now();
            const step = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const current = numeric * progress;
              el.textContent = `${current % 1 === 0 ? Math.round(current) : current.toFixed(1)}${suffix}`;
              if (progress < 1) requestAnimationFrame(step);
              else el.textContent = value;
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [value, reducedMotion]);

  return (
    <div ref={wrapperRef} className="text-center">
      <span ref={ref} className="block text-4xl font-bold text-aqua sm:text-5xl">
        0
      </span>
      <span className="mt-2 block text-xs uppercase tracking-widest text-ink-muted">{label}</span>
    </div>
  );
}

function RevealSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { reducedMotion } = useHoverCapable();

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function InteractiveHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { hoverCapable, reducedMotion } = useHoverCapable();
  const [spot, setSpot] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const el = heroRef.current;
    if (!el || !hoverCapable || reducedMotion) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setSpot({ x, y });
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, [hoverCapable, reducedMotion]);

  return (
    <div
      ref={heroRef}
      className="relative flex min-h-screen flex-col items-start justify-center overflow-hidden bg-ink px-6 sm:px-12"
      style={{
        backgroundImage: `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(65,230,208,0.18), transparent 55%)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          transform: hoverCapable && !reducedMotion ? `translate(${(spot.x - 50) * -0.1}px, ${(spot.y - 50) * -0.1}px)` : undefined,
        }}
      />
      <span className="relative z-10 mb-6 inline-block rounded-full border border-ink-border px-4 py-1 text-xs uppercase tracking-widest text-azure">
        Experience 03 — Interactive
      </span>
      <h1 className="relative z-10 max-w-4xl text-5xl font-bold leading-[1.05] text-ink-foreground sm:text-7xl">
        {demoBrand.name}
      </h1>
      <p className="relative z-10 mt-6 max-w-xl text-lg text-ink-muted">{demoBrand.promise}</p>
      <div className="relative z-10 mt-10 flex flex-wrap gap-4">
        <MagneticButton>Explore residences</MagneticButton>
        <button className="rounded-full border border-ink-border px-8 py-4 text-sm font-semibold uppercase tracking-wide text-ink-foreground transition-colors hover:border-azure hover:text-azure">
          Book a visit
        </button>
      </div>
    </div>
  );
}

function ResidenceExplainer() {
  const [activeUnit, setActiveUnit] = useState(demoUnits[0]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {demoUnits.map((unit) => (
          <button
            key={unit.id}
            onMouseEnter={() => setActiveUnit(unit)}
            onFocus={() => setActiveUnit(unit)}
            onClick={() => setActiveUnit(unit)}
            className={`rounded-xl border p-5 text-left transition-colors duration-300 ${
              activeUnit?.id === unit.id
                ? "border-aqua bg-ink text-ink-foreground"
                : "border-ink-border bg-ink/40 text-ink-muted hover:border-azure"
            }`}
          >
            <span className="block text-lg font-semibold">{unit.id}</span>
            <span className="mt-1 block text-xs uppercase tracking-wide">{unit.type}</span>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-ink-border bg-ink/60 p-8">
        {activeUnit && (
          <>
            <h4 className="text-2xl font-semibold text-ink-foreground">{activeUnit.id}</h4>
            <p className="mt-1 text-sm uppercase tracking-wide text-azure">{activeUnit.type}</p>
            <dl className="mt-6 space-y-3 text-sm text-ink-muted">
              <div className="flex justify-between border-b border-ink-border pb-2">
                <dt>Bedrooms</dt>
                <dd className="text-ink-foreground">{activeUnit.beds}</dd>
              </div>
              <div className="flex justify-between border-b border-ink-border pb-2">
                <dt>Area</dt>
                <dd className="text-ink-foreground">{activeUnit.area} sq ft</dd>
              </div>
              <div className="flex justify-between border-b border-ink-border pb-2">
                <dt>Facing</dt>
                <dd className="text-ink-foreground">{activeUnit.facing}</dd>
              </div>
              <div className="flex justify-between border-b border-ink-border pb-2">
                <dt>Price</dt>
                <dd className="text-ink-foreground">{activeUnit.price}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Status</dt>
                <dd className="text-aqua">{activeUnit.status}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

function InteractiveDemo() {
  return (
    <main className="min-h-screen bg-ink text-ink-foreground">
      <InteractiveHero />

      <RevealSection className="mx-auto max-w-6xl px-6 py-24 sm:px-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {demoStats.map((stat) => (
            <CountingStat key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      </RevealSection>

      <RevealSection className="mx-auto max-w-6xl px-6 pb-24 sm:px-12">
        <h2 className="mb-10 text-3xl font-semibold sm:text-4xl">What {demoBrand.name} offers</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {demoServices.map((service) => (
            <TiltCard key={service.title} title={service.title} body={service.body} />
          ))}
        </div>
      </RevealSection>

      <RevealSection className="mx-auto max-w-6xl px-6 pb-24 sm:px-12">
        <h2 className="mb-10 text-3xl font-semibold sm:text-4xl">Explore the residences</h2>
        <ResidenceExplainer />
      </RevealSection>

      <RevealSection className="mx-auto max-w-4xl px-6 pb-32 text-center sm:px-12">
        <h2 className="text-3xl font-semibold sm:text-4xl">{demoBrand.promise}</h2>
        <p className="mt-4 text-ink-muted">{demoBrand.location}</p>
        <div className="mt-10 flex justify-center">
          <MagneticButton>Reserve your residence</MagneticButton>
        </div>
      </RevealSection>
    </main>
  );
}
