import Image from "next/image";

type Props = {
  image: string;
  hoverImage?: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
};

/** Same primary / secondary hover swap as the catalog product card. */
export function OrderLineThumb({
  image,
  hoverImage,
  alt = "",
  className = "track-thumb",
  sizes = "96px",
}: Props) {
  const swap = Boolean(hoverImage && hoverImage !== image);

  return (
    <div className={`media-frame ${className}${swap ? " track-thumb--swap" : ""}`}>
      {image ? (
        <Image src={image} alt={alt} fill sizes={sizes} className="media-primary object-contain" />
      ) : null}
      {swap ? (
        <Image
          src={hoverImage as string}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          className="media-secondary object-contain opacity-0"
        />
      ) : null}
    </div>
  );
}
