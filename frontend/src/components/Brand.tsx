import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="エンジニア・ガレージ トップへ">
      <span className="brand-mark" aria-hidden>
        G
      </span>
      エンジニア・ガレージ
    </Link>
  );
}
