import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="ソトバ トップへ">
      <span className="brand-mark" aria-hidden>
        ソ
      </span>
      ソトバ
    </Link>
  );
}
