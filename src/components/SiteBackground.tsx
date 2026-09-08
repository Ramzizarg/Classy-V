/** Fixed full-viewport camo — covers every page height, including mobile chrome gaps. */
export function SiteBackground() {
  return (
    <div className="site-bg" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="site-bg__img"
        src="/images/site-bg.png?v=2"
        alt=""
        decoding="async"
        fetchPriority="low"
      />
    </div>
  );
}
