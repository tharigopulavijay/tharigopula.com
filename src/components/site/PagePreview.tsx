/**
 * Small drawn representations of the pages a visitor can go to.
 *
 * The alternative was generic dashboard stock imagery, which is a poor look on
 * a site selling real dashboards — and screenshots would go stale the moment a
 * page changed. These are drawn from the same tokens as the site, so they stay
 * on-brand, weigh nothing, and read correctly in both themes.
 *
 * Each one abstracts the actual layout of its destination: the platform demo
 * shows a sidebar and KPI row, the studio shows stacked browser frames, the
 * estimator shows a form beside a result panel.
 */

const FRAME = "h-full w-full overflow-hidden rounded-lg border border-border bg-background";

function Bar({ w, h = 4, dim = 0.25 }: { w: string; h?: number; dim?: number }) {
  return (
    <div
      className="rounded-full bg-foreground"
      style={{ width: w, height: h, opacity: dim }}
      aria-hidden
    />
  );
}

/** Solutions — a grid of capability cards. */
export function PreviewSolutions() {
  return (
    <div className={FRAME}>
      <div className="flex items-center gap-1 border-b border-border px-2.5 py-1.5">
        <Bar w="34px" h={3} dim={0.35} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded border border-border bg-card p-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-signal" style={{ opacity: 0.85 }} />
            <div className="mt-1.5 flex flex-col gap-1">
              <Bar w="80%" h={2.5} />
              <Bar w="55%" h={2.5} dim={0.15} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Platform demo — dark app shell with sidebar, KPIs and a chart. */
export function PreviewPlatform() {
  return (
    <div className={FRAME} style={{ background: "#0B1524" }}>
      <div className="flex h-full">
        <div className="w-1/4 border-r p-1.5" style={{ borderColor: "#1C2E4A" }}>
          <div className="h-2.5 w-2.5 rounded-sm" style={{ background: "#F59E0B" }} />
          <div className="mt-2 flex flex-col gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  height: 3,
                  width: i === 1 ? "85%" : "65%",
                  background: i === 1 ? "#F59E0B" : "#31456080",
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex-1 p-1.5">
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded p-1" style={{ background: "#111E33" }}>
                <div
                  className="rounded-sm"
                  style={{ height: 2, width: "60%", background: "#31456080" }}
                />
                <div
                  className="mt-1 rounded-sm"
                  style={{ height: 4, width: "45%", background: "#E8EFFA" }}
                />
              </div>
            ))}
          </div>
          <div
            className="mt-1.5 flex h-[38px] items-end gap-1 rounded p-1.5"
            style={{ background: "#111E33" }}
          >
            {[40, 62, 48, 78, 58, 92].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm"
                style={{ height: `${h}%`, background: i === 5 ? "#F59E0B" : "#F59E0B44" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Website Studio — stacked browser frames showing experience levels. */
export function PreviewStudio() {
  return (
    <div className={FRAME}>
      <div className="relative h-full p-2.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded border border-border bg-card shadow-sm"
            style={{
              inset: `${10 + i * 7}px ${8 + i * 9}px ${14 - i * 4}px ${8 + i * 9}px`,
              zIndex: i,
            }}
          >
            <div className="flex gap-0.5 border-b border-border px-1.5 py-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1 w-1 rounded-full bg-foreground/20" />
              ))}
            </div>
            {i === 2 ? (
              <div className="p-1.5">
                <Bar w="70%" h={4} dim={0.5} />
                <div className="mt-1 flex gap-1">
                  <Bar w="40%" h={2.5} dim={0.18} />
                </div>
                <div className="mt-1.5 h-3 w-10 rounded-sm bg-signal" style={{ opacity: 0.9 }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Work — case study cards carrying status labels. */
export function PreviewWork() {
  return (
    <div className={FRAME}>
      <div className="flex h-full flex-col gap-1.5 p-2.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded border border-border bg-card p-1.5"
          >
            <div className="h-6 w-8 shrink-0 rounded-sm bg-secondary" />
            <div className="flex-1">
              <div
                className="rounded-sm bg-signal"
                style={{ height: 3, width: 24, opacity: 0.75 }}
              />
              <div className="mt-1 flex flex-col gap-0.5">
                <Bar w="85%" h={2.5} />
                <Bar w="55%" h={2.5} dim={0.15} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pricing — form on the left, live estimate panel on the right. */
export function PreviewPricing() {
  return (
    <div className={FRAME}>
      <div className="flex h-full gap-1.5 p-2.5">
        <div className="flex flex-1 flex-col gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded border p-1"
              style={{
                borderColor:
                  i === 1 ? "var(--color-signal, #2563eb)" : "var(--color-border, #e5e7eb)",
              }}
            >
              <Bar w={i === 1 ? "70%" : "50%"} h={2.5} dim={i === 1 ? 0.5 : 0.2} />
            </div>
          ))}
        </div>
        <div className="flex-1 rounded border border-border bg-secondary/60 p-1.5">
          <Bar w="55%" h={2.5} dim={0.25} />
          <div className="mt-2 flex flex-col gap-1">
            <Bar w="80%" h={2.5} dim={0.15} />
            <Bar w="65%" h={2.5} dim={0.15} />
          </div>
          <div
            className="mt-2 rounded-sm bg-signal"
            style={{ height: 6, width: "72%", opacity: 0.9 }}
          />
        </div>
      </div>
    </div>
  );
}
