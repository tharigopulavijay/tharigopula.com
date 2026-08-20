/**
 * Data behind the dashboard demo.
 *
 * A dashboard is only worth anything if the numbers move when you ask a
 * different question, so this carries twelve months of daily-ish figures across
 * four branches and five product groups. The demo filters real records rather
 * than swapping between pre-baked screenshots.
 *
 * Fictional business, illustrative figures.
 */

export type Branch = "Hyderabad" | "Vijayawada" | "Bengaluru" | "Chennai";
export type Group = "Pumps" | "Motors" | "Panels" | "Spares" | "Service";

export type Sale = {
  /** ISO date. */
  d: string;
  branch: Branch;
  group: Group;
  revenue: number;
  units: number;
  /** Gross margin on that revenue. */
  margin: number;
};

const BRANCHES: Branch[] = ["Hyderabad", "Vijayawada", "Bengaluru", "Chennai"];
const GROUPS: Group[] = ["Pumps", "Motors", "Panels", "Spares", "Service"];

/** Relative size of each branch and group, so the mix looks like a real business. */
const BRANCH_WEIGHT: Record<Branch, number> = {
  Hyderabad: 1.0,
  Vijayawada: 0.62,
  Bengaluru: 0.78,
  Chennai: 0.45,
};
const GROUP_PROFILE: Record<Group, { weight: number; price: number; margin: number }> = {
  Pumps: { weight: 1.0, price: 38000, margin: 0.24 },
  Motors: { weight: 0.7, price: 26000, margin: 0.21 },
  Panels: { weight: 0.5, price: 12000, margin: 0.31 },
  Spares: { weight: 0.9, price: 2400, margin: 0.38 },
  Service: { weight: 0.6, price: 3800, margin: 0.52 },
};

/**
 * Deterministic pseudo-random so the dashboard shows the same figures to
 * everyone and on every reload. A real random seed would mean the numbers moved
 * under a visitor mid-conversation, which reads as broken rather than live.
 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function buildSales(): Sale[] {
  const rand = rng(20260820);
  const rows: Sale[] = [];
  const today = new Date();

  for (let back = 364; back >= 0; back--) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const dow = dt.getDay();
    if (dow === 0) continue; // closed Sundays

    // Gentle upward trend plus a festive lift around Sep–Nov.
    const trend = 1 + ((364 - back) / 364) * 0.28;
    const month = dt.getMonth();
    const festive = month >= 8 && month <= 10 ? 1.18 : 1;

    for (const branch of BRANCHES) {
      for (const group of GROUPS) {
        const g = GROUP_PROFILE[group];
        // Not every branch sells every group every day.
        if (rand() > 0.34 * g.weight * BRANCH_WEIGHT[branch] + 0.12) continue;
        const units = 1 + Math.floor(rand() * 4 * g.weight);
        const revenue = Math.round(units * g.price * (0.92 + rand() * 0.2) * trend * festive);
        rows.push({
          d: iso,
          branch,
          group,
          revenue,
          units,
          margin: Math.round(revenue * (g.margin + (rand() - 0.5) * 0.06)),
        });
      }
    }
  }
  return rows;
}

export const sales: Sale[] = buildSales();
export const branches = BRANCHES;
export const groups = GROUPS;

export const RANGES = [
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "365", label: "Last 12 months", days: 365 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];
