import Image from "next/image";

type Blob = "yellow" | "pink" | "mint" | "violet";

// 写真＋網点＋色丸。写真そのものは scripts/process-photos.mjs でトーンを揃えてある
export function Photo({
  src,
  alt,
  className = "",
  blob = "yellow",
  extraBlob,
  priority = false,
  sizes = "(max-width: 860px) 100vw, 50vw",
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  blob?: Blob;
  extraBlob?: Blob;
  priority?: boolean;
  sizes?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`photo ${className}`}>
      <span className="dots" aria-hidden />
      <div className="photo-frame">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />
      </div>
      <span className={`blob blob-${blob}`} aria-hidden />
      {extraBlob && <span className={`blob blob-${extraBlob}`} aria-hidden />}
      {children}
    </div>
  );
}
