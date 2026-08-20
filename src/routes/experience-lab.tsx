import { createFileRoute, redirect } from "@tanstack/react-router";

/** The tier comparison now lives on Showcase → Websites alongside the demos. */
export const Route = createFileRoute("/experience-lab")({
  beforeLoad: () => {
    throw redirect({ to: "/showcase/websites", replace: true });
  },
});
