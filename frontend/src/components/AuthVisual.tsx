import Image from "next/image";
import { asset } from "../lib/demo";

export function AuthVisual({ photo = "hero.webp", title, body }: { photo?: string; title: string; body: string }) {
  return (
    <aside className="auth-visual">
      <Image src={asset(`/photos/${photo}`)} alt="" fill sizes="50vw" priority style={{ objectFit: "cover" }} />
      <div className="auth-visual-caption">
        <span className="eyebrow">SOTOBA</span>
        <strong>{title}</strong>
        <span className="small muted">{body}</span>
      </div>
    </aside>
  );
}
