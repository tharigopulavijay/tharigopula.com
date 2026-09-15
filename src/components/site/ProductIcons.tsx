/**
 * One drawn mark per product.
 *
 * Kept as inline SVG rather than an icon package: five icons is not worth a
 * dependency, and these are drawn to sit on the same optical weight as the
 * existing marks in HomeGrids rather than a library's house style.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Stethoscope over a cross — care, not a hospital building. */
function Clinical() {
  return (
    <Frame>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M4 3h3M13 3h3" />
      <path d="M10 12v2a5 5 0 0 0 10 0v-1" />
      <circle cx="20" cy="11" r="2" />
    </Frame>
  );
}

/** A mortarboard. */
function Educational() {
  return (
    <Frame>
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5" />
      <path d="M21 9.5V15" />
    </Frame>
  );
}

/** A plant with a gear — production, not a generic factory outline. */
function Industrial() {
  return (
    <Frame>
      <path d="M3 21V10l5 3V10l5 3V7l8 5v9" />
      <path d="M3 21h18" />
      <path d="M17 16h.01M13 16h.01" />
    </Frame>
  );
}

/** A bed with a bell — the front desk, which is what the system is about. */
function Hotel() {
  return (
    <Frame>
      <path d="M3 18v-6h13a4 4 0 0 1 4 4v2" />
      <path d="M3 18h18" />
      <path d="M3 12V7" />
      <circle cx="7.5" cy="10" r="1.8" />
    </Frame>
  );
}

/** A paw. */
function Znuffi() {
  return (
    <Frame>
      <circle cx="8" cy="7" r="1.9" />
      <circle cx="16" cy="7" r="1.9" />
      <circle cx="5" cy="13" r="1.7" />
      <circle cx="19" cy="13" r="1.7" />
      <path d="M12 12c2.6 0 5 2.4 5 4.8 0 1.9-1.6 3.2-3.4 2.8-1-.2-2.2-.2-3.2 0C8.6 20 7 18.7 7 16.8 7 14.4 9.4 12 12 12Z" />
    </Frame>
  );
}

const ICONS = {
  clinical: Clinical,
  educational: Educational,
  industrial: Industrial,
  hotel: Hotel,
  znuffi: Znuffi,
} satisfies Record<string, () => React.JSX.Element>;

/** Falls back to the clinical mark rather than rendering nothing for a new slug. */
export function productIcon(slug: string): () => React.JSX.Element {
  return ICONS[slug as keyof typeof ICONS] ?? Clinical;
}
