/** Fixed full-viewport camo — sits under content, never behind html black. */
export function SiteBackground() {
  return (
    <div className="site-bg" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/site-bg.png"
        alt=""
        className="site-bg__img"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
