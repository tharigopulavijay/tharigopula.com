import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved under /showcase. See live-demos.index.tsx for the reasoning. */
export const Route = createFileRoute("/live-demos/automation")({
  beforeLoad: () => {
    throw redirect({ to: "/showcase/automation", replace: true });
  },
});
