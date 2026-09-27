import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="エンジニア1st トップへ">
      <span className="brand-mark" aria-hidden>
        1
      </span>
      エンジニア1st
    </Link>
  );
}
