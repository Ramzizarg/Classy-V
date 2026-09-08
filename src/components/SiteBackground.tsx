/** Fixed full-viewport camo — independent of page height. */
export function SiteBackground() {
  return (
    <div className="site-bg" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/site-bg.png"
        alt=""
        className="site-bg__img"
        decoding="async"
        fetchPriority="low"
      />
    </div>
  );
}
