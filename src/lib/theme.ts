/**
 * Theme preference: light or dark.
 *
 * Two states, not three. A "follow my device" option looked like a duplicate of
 * whichever mode the device was already in — two of the three buttons rendered
 * the same page — so the choice is now explicit and the device preference is
 * used only to pick the starting side on a first visit.
 *
 * The applied class lives on <html> so Tailwind's `dark` variant and the
 * `color-scheme` property both pick it up.
 */

export type Theme = "light" | "dark";

export const THEME_KEY = "tg:theme";

/** What the device asks for, used only when nothing has been chosen yet. */
export function devicePreference(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The stored choice, falling back to the device on a first visit. */
export function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode — fall through to the device preference */
  }
  return devicePreference();
}

/** Applies a preference to the document and remembers it. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the theme still applies for this visit */
  }
}

/**
 * Runs before first paint to stop a light flash on a dark-mode device.
 *
 * Inlined into <head> as a blocking script. Kept deliberately small and
 * dependency-free because it executes before the bundle has loaded.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var k=localStorage.getItem(${JSON.stringify(THEME_KEY)});
var d=k==='dark'||(k!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
if(d)document.documentElement.classList.add('dark');
}catch(e){}})();`;
