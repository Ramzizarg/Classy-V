"use client";

import { useSyncExternalStore } from "react";
import { MoonGlyph, SunGlyph } from "@/components/SocialGlyphs";
import { readSiteTheme, setSiteTheme, subscribeSiteTheme, type SiteTheme } from "@/lib/siteTheme";

const serverTheme = (): SiteTheme => "day";

/** Header switch between day (default) and night mode. Shows the mode it switches to. */
export function ThemeToggle({ className = "h-6 w-6" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeSiteTheme, readSiteTheme, serverTheme);
  const next: SiteTheme = theme === "day" ? "night" : "day";
  const label = next === "day" ? "Switch to day mode" : "Switch to night mode";

  return (
    <button
      type="button"
      onClick={() => setSiteTheme(next)}
      aria-label={label}
      title={label}
      className="theme-toggle -m-1 p-1"
    >
      <span key={theme} className="theme-toggle__icon">
        {next === "day" ? <SunGlyph className={className} /> : <MoonGlyph className={className} />}
      </span>
    </button>
  );
}
