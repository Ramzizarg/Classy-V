import { InstagramGlyph } from "@/components/SocialGlyphs";
import { SITE } from "@/lib/site";

export function SocialLinks({ className }: { className?: string }) {
  return (
    <div className={className}>
      <a
        href={SITE.instagram}
        target="_blank"
        rel="noreferrer"
        aria-label="Instagram"
        className="social-chip inline-flex h-7 w-7 items-center justify-center bg-white text-black transition hover:opacity-80"
      >
        <InstagramGlyph className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
