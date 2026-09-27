"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { href: "/clubs", label: "部活" },
  { href: "/events", label: "勉強会・イベント" },
  { href: "/#tools", label: "無料ツール" },
  { href: "/#ses", label: "SESで働く方へ" },
];

export function SiteHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={"site-header" + (scrolled ? " is-scrolled" : "")}>
      <div className="site-header-inner">
        <Brand />
        <nav className="site-nav" aria-label="メイン">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="site-actions">
          {loading ? null : user ? (
            <Link href="/mypage" className="btn-primary btn-sm">
              マイページ <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary btn-sm">
                ログイン
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                無料で登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
