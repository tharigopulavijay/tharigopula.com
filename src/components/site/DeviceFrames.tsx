import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Phone, tablet and laptop shells.
 *
 * A flat app screenshot floating on a page reads as a picture of software. The
 * same screen inside a device body reads as software you could pick up — which
 * is the whole point of a demo page, so the frames are worth the markup.
 *
 * Scaling is done with a transform rather than by shrinking the frame, because
 * the screens inside are laid out in fixed pixels: a narrower frame would
 * reflow and overflow their text instead of making it smaller. The wrapper
 * reserves the scaled footprint so surrounding layout still works.
 *
 * Each frame owns its own dark chrome and does not follow the site theme: a
 * phone is a physical object, and one that turns white in light mode stops
 * looking like one. The screen inside carries the app.
 */

const BODY = "linear-gradient(150deg, #3A4A63 0%, #16202F 45%, #0B1220 100%)";

/** Reserves `w×h × scale` of layout, then scales the natural-size device into it. */
function Scaled({
  w,
  h,
  scale,
  className,
  children,
}: {
  w: number;
  h: number;
  scale: number;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: w * scale, height: h * scale }}
    >
      <div
        style={{
          width: w,
          height: h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Phone({
  children,
  className,
  scale = 1,
}: {
  children: ReactNode;
  className?: string | undefined;
  scale?: number | undefined;
}) {
  return (
    <Scaled w={260} h={540} scale={scale} className={className}>
      <div
        className="h-full w-full rounded-[2.4rem] p-[3px] shadow-plate"
        style={{ background: BODY }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[2.2rem] bg-white">
          {/* Notch. Above the screen content so app chrome can run full-bleed. */}
          <div
            aria-hidden
            className="absolute top-0 left-1/2 z-20 h-[22px] w-[38%] -translate-x-1/2 rounded-b-2xl"
            style={{ background: "#0B1220" }}
          />
          <div className="h-full w-full overflow-hidden">{children}</div>
        </div>
      </div>
    </Scaled>
  );
}

export function Tablet({
  children,
  className,
  scale = 1,
  landscape,
}: {
  children: ReactNode;
  className?: string | undefined;
  scale?: number | undefined;
  /** Turn the tablet on its side — what a split two-pane layout wants. */
  landscape?: boolean | undefined;
}) {
  return (
    <Scaled w={landscape ? 620 : 420} h={landscape ? 440 : 560} scale={scale} className={className}>
      <div
        className="h-full w-full rounded-[1.7rem] p-[3px] shadow-plate"
        style={{ background: BODY }}
      >
        <div className="h-full w-full overflow-hidden rounded-[1.5rem] bg-white">{children}</div>
      </div>
    </Scaled>
  );
}

export function Laptop({
  children,
  className,
  scale = 1,
}: {
  children: ReactNode;
  className?: string | undefined;
  scale?: number | undefined;
}) {
  // 380 screen + 10 top bezel + 13 base.
  return (
    <Scaled w={640} h={403} scale={scale} className={className}>
      <div className="rounded-t-xl p-[10px] pb-0 shadow-plate" style={{ background: BODY }}>
        <div className="h-[380px] overflow-hidden rounded-t-md bg-white">{children}</div>
      </div>
      {/* Base. The wider lip and hinge notch are what stop this reading as a box. */}
      <div
        aria-hidden
        className="relative -mx-[2%] h-[13px] w-[104%] rounded-b-xl"
        style={{ background: "linear-gradient(180deg, #33425C 0%, #141D2B 100%)" }}
      >
        <span
          className="absolute top-0 left-1/2 h-[5px] w-[14%] -translate-x-1/2 rounded-b-full"
          style={{ background: "#0B1220" }}
        />
      </div>
    </Scaled>
  );
}
