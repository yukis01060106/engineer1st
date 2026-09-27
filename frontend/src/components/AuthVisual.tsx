import Image from "next/image";

export function AuthVisual({ photo = "hero.webp", title, body }: { photo?: string; title: string; body: string }) {
  return (
    <aside className="auth-visual">
      <Image src={`/photos/${photo}`} alt="" fill sizes="50vw" priority style={{ objectFit: "cover" }} />
      <div className="auth-visual-caption">
        <span className="eyebrow">Engineer 1st</span>
        <strong>{title}</strong>
        <span className="small muted">{body}</span>
      </div>
    </aside>
  );
}
