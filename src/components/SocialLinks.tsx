import { InstagramGlyph } from "@/components/SocialGlyphs";
import { SITE } from "@/lib/site";

export function SocialLinks({ className }: { className?: string }) {
  return (
    <div className={className}>
      <a
        href={SITE.instagram}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-foreground opacity-90 transition hover:opacity-100"
      >
        <span className="social-chip inline-flex h-7 w-7 shrink-0 items-center justify-center bg-white text-black">
          <InstagramGlyph className="h-3.5 w-3.5" />
        </span>
        <span className="ui">Instagram</span>
      </a>
    </div>
  );
}
