/** Hand-rolled glyphs so the utility row stays hairline-thin and icon-set free. */

type GlyphProps = { className?: string };

export function InstagramGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SearchGlyph({ className = "h-3.5 w-3.5" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
      className={className}
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L21 21" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function MenuGlyph({ className = "h-5 w-5" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M4 9h16M4 15h16" />
    </svg>
  );
}

export function CloseGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export function BagGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M4 7h16l-1.3 13.2a1 1 0 0 1-1 .8H6.3a1 1 0 0 1-1-.8L4 7Z" />
      <path
        d="M8.4 8.2V6.4a3.6 3.6 0 0 1 7.2 0v1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeartGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 20.4S3.5 15.2 3.5 9.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 2.4C20.5 15.2 12 20.4 12 20.4Z" />
    </svg>
  );
}

export function TikTokGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M14.2 3h2.1c.2 1.7 1.2 3.2 2.7 4.1v2.3a6.6 6.6 0 0 1-2.7-.7v5.6a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v2.5a3.4 3.4 0 1 0 2.5 3.3V3Z" />
    </svg>
  );
}
