import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /live-demos moved to /showcase when Website Studio, Live Demos and the
 * Experience Lab were merged into one section. Kept as a redirect so links
 * shared before the rename, and anything already indexed, still land somewhere.
 */
export const Route = createFileRoute("/live-demos/")({
  beforeLoad: () => {
    throw redirect({ to: "/showcase", replace: true });
  },
});
