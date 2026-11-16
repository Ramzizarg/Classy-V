/** Fly a product thumbnail into the header wishlist target. */

export const WISHLIST_TARGET_ATTR = "data-wishlist-target";

export type WishlistFlyRequest = {
  image: string;
  from: DOMRect;
};

function isVisiblyOnScreen(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  if (rect.width < 2 || rect.height < 2) return false;
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (Number(style.opacity) < 0.05) return false;
  if (style.pointerEvents === "none") return false;
  // Header can be translated off-screen while still having a box.
  if (rect.bottom < 8 || rect.top > window.innerHeight - 8) return false;
  if (rect.right < 8 || rect.left > window.innerWidth - 8) return false;
  return true;
}

function visibleWishlistTarget(): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[${WISHLIST_TARGET_ATTR}]`));
  return nodes.find(isVisiblyOnScreen) ?? null;
}

/** When the header is hidden (home retreat), land in the usual top-right wishlist slot. */
function fallbackWishlistRect(): DOMRect {
  const size = 40;
  const right = 18;
  const top = 18 + (document.querySelector(".site-announce") ? 30 : 0);
  return new DOMRect(window.innerWidth - right - size, top, size, size);
}

function pulseWishlistTarget(target: HTMLElement | null, at: DOMRect) {
  if (target) {
    target.classList.remove("wishlist-target--pulse");
    void target.offsetWidth;
    target.classList.add("wishlist-target--pulse");
    window.setTimeout(() => target.classList.remove("wishlist-target--pulse"), 700);
    return;
  }

  // Temporary catcher when the real header target is off-screen.
  const catcher = document.createElement("div");
  catcher.className = "wishlist-fly-catcher";
  catcher.setAttribute("aria-hidden", "true");
  catcher.style.left = `${at.left}px`;
  catcher.style.top = `${at.top}px`;
  catcher.style.width = `${at.width}px`;
  catcher.style.height = `${at.height}px`;
  catcher.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.6"><path d="M12 20.4S3.5 15.2 3.5 9.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 2.4C20.5 15.2 12 20.4 12 20.4Z"/></svg>';
  document.body.appendChild(catcher);
  window.setTimeout(() => catcher.remove(), 900);
}

/**
 * Animates a ghost product image from `from` into the header wishlist icon.
 * Returns true when the flight was started.
 */
export function flyProductToWishlist(request: WishlistFlyRequest): boolean {
  if (typeof document === "undefined") return false;
  const image = request.image?.trim();
  if (!image) return false;

  const from = request.from;
  if (from.width < 2 || from.height < 2) return false;

  const target = visibleWishlistTarget();
  const to = target?.getBoundingClientRect() ?? fallbackWishlistRect();
  if (to.width < 2 || to.height < 2) return false;

  const size = Math.min(72, Math.max(44, Math.round(Math.min(from.width, from.height) * 0.42)));
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const endX = to.left + to.width / 2 - size / 2;
  const endY = to.top + to.height / 2 - size / 2;

  const ghost = document.createElement("div");
  ghost.className = "wishlist-fly";
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;

  const img = document.createElement("img");
  img.src = image;
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  ghost.appendChild(img);
  document.body.appendChild(ghost);

  const dx = endX - startX;
  const dy = endY - startY;
  const lift = Math.min(120, Math.max(48, Math.abs(dy) * 0.18 + 36));
  const duration = Math.min(1600, Math.max(1100, Math.hypot(dx, dy) * 0.95 + 900));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = () => {
    ghost.remove();
    pulseWishlistTarget(target, to);
  };

  if (reduced || typeof ghost.animate !== "function") {
    finish();
    return true;
  }

  const animation = ghost.animate(
    [
      {
        transform: "translate(0px, 0px) scale(1)",
        opacity: 1,
        offset: 0,
      },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.35 - lift}px) scale(0.92)`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.22)`,
        opacity: 0.15,
        offset: 1,
      },
    ],
    {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  animation.finished.then(finish).catch(finish);
  return true;
}

/** Best source rect: product media near the control, else the control itself. */
export function wishlistFlyOrigin(from: HTMLElement | null | undefined): DOMRect | null {
  if (!from || typeof document === "undefined") return null;

  const media =
    from.closest(".lookbook-card")?.querySelector(".lookbook-card__media, .lookbook-card__frame") ??
    from.closest(".cv-shop__card")?.querySelector(".cv-shop__media, .cv-shop__frame") ??
    from.closest("main, .product-shell, .product-layout, .site-shell")?.querySelector(
      ".product-gallery__main, .product-gallery__main img, [data-product-media]",
    ) ??
    document.querySelector(".product-gallery__main img, .product-gallery__main") ??
    null;

  const el = (media as HTMLElement | null) ?? from;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return from.getBoundingClientRect();
  return rect;
}
