import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved under /showcase. See live-demos.index.tsx for the reasoning. */
export const Route = createFileRoute("/live-demos/websites")({
  beforeLoad: () => {
    throw redirect({ to: "/showcase/websites", replace: true });
  },
});
