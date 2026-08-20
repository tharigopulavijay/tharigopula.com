/**
 * Theme preference: light, dark, or follow the device.
 *
 * Three states rather than two on purpose. A plain toggle forces a permanent
 * choice, but most people want the site to follow their phone — bright by day,
 * dark at night — without thinking about it. "System" is the default for that
 * reason, and an explicit choice overrides it until they change it back.
 *
 * The applied class lives on <html> so Tailwind's `dark` variant and the
 * `color-scheme` property both pick it up.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "tg:theme";

/** Reads the stored preference. Returns "system" when nothing is set. */
export function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Resolves "system" to whatever the device is actually asking for. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies a preference to the document and remembers it. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
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
