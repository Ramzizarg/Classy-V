/**
 * Storefront day / night mode. Night is the brand default; day is opt-in and
 * remembered per browser. The back office keeps its own light theme.
 */

export type SiteTheme = "night" | "day";

export const SITE_THEME_STORAGE_KEY = "classyv-theme";

const THEME_EVENT = "classyv-theme-change";
const UNTHEMED_PATH = /^\/(dashboard|admin|api|backoffice|login)(\/|$)/i;
const BROWSER_BAR: Record<SiteTheme, string> = { night: "#000000", day: "#ffffff" };

export function readSiteTheme(): SiteTheme {
  try {
    return localStorage.getItem(SITE_THEME_STORAGE_KEY) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

export function applySiteTheme(theme: SiteTheme, pathname: string = window.location.pathname) {
  const root = document.documentElement;
  const active: SiteTheme = theme === "day" && !UNTHEMED_PATH.test(pathname) ? "day" : "night";
  if (active === "day") root.setAttribute("data-theme", "day");
  else root.removeAttribute("data-theme");
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", BROWSER_BAR[active]));
}

export function setSiteTheme(theme: SiteTheme) {
  try {
    localStorage.setItem(SITE_THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode: the choice still applies for this page view. */
  }
  applySiteTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeSiteTheme(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SITE_THEME_STORAGE_KEY) return;
    applySiteTheme(readSiteTheme());
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Runs in <head> so a saved day mode is on the page before first paint. */
export const SITE_THEME_BOOT_SCRIPT = `(function(){try{if(${UNTHEMED_PATH}.test(location.pathname))return;if(localStorage.getItem("${SITE_THEME_STORAGE_KEY}")==="day")document.documentElement.setAttribute("data-theme","day");}catch(e){}})();`;
