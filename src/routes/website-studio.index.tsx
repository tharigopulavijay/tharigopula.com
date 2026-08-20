import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Website Studio merged into Showcase → Websites.
 *
 * It and the Live Demos website page were answering two halves of the same
 * question — what capability level, and what visual direction — from two
 * separate places in the nav, with near-identical category names. They are one
 * page now, in that order.
 */
export const Route = createFileRoute("/website-studio/")({
  beforeLoad: () => {
    throw redirect({ to: "/showcase/websites", replace: true });
  },
});
