"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// 印刷・PDF保存用ページの枠（ログインが必要。ブラウザの印刷機能で「PDFに保存」できる）
export function PrintShell({ back, backLabel, actions, children }: { back: string; backLabel: string; actions?: ReactNode; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <div className="loading-screen">読み込み中…</div>;

  return (
    <div className="print-page">
      <div className="print-toolbar">
        <Link href={back} className="btn-ghost btn-sm">
          <ArrowLeft size={14} /> {backLabel}
        </Link>
        <div className="inline">
          {actions}
          <button className="btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> 印刷・PDFで保存
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
