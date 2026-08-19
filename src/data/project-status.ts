/**
 * Project status classification.
 *
 * A visitor reading the portfolio could not tell which projects were delivered
 * for a paying client and which were designed to demonstrate an approach. Both
 * are legitimate and worth showing — but presenting one as the other is the
 * fastest way to lose a serious buyer, and the hardest thing to recover from.
 *
 * Every case study now declares what it is, on the card and on the page.
 */

export type ProjectStatus =
  "live-client" | "client-prototype" | "internal-product" | "concept" | "demo";

export type StatusMeta = {
  /** Short label shown on cards. */
  label: string;
  /** One line explaining exactly what the label means, shown on the detail page. */
  meaning: string;
  /** Semantic weight — "proof" reads strongest, "illustrative" is honest about being a design. */
  weight: "proof" | "partial" | "illustrative";
};

export const projectStatuses: Record<ProjectStatus, StatusMeta> = {
  "live-client": {
    label: "Live client project",
    meaning: "Built for a paying client and running in their business.",
    weight: "proof",
  },
  "client-prototype": {
    label: "Client prototype",
    meaning:
      "Designed and built with a real client to test the approach. Not yet running day to day.",
    weight: "partial",
  },
  "internal-product": {
    label: "Internal product",
    meaning: "Built and used by Tharigopula, not for an external client.",
    weight: "partial",
  },
  concept: {
    label: "Worked concept",
    meaning:
      "A solution designed in full — workflow, data model and screens — to show how this kind of business would be built. Not a delivered project.",
    weight: "illustrative",
  },
  demo: {
    label: "Interactive demo",
    meaning: "A working demonstration you can click through. Sample data, not a real business.",
    weight: "illustrative",
  },
};

export const statusMeta = (s: ProjectStatus) => projectStatuses[s];
