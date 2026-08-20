import { createFileRoute, redirect } from "@tanstack/react-router";

/** Template detail pages moved to /showcase/templates/$slug. */
export const Route = createFileRoute("/website-studio/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/showcase/templates/$slug", params, replace: true });
  },
});
