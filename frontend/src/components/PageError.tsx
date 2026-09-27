"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

// 読み込みに失敗したとき・権限がないときの表示（再読み込みとホームへの導線を必ず出す）
export function PageError({ title = "うまく表示できませんでした", message, retry = true }: { title?: string; message: string; retry?: boolean }) {
  return (
    <div className="page">
      <div className="panel stack" role="alert" style={{ maxWidth: 560, justifyItems: "start" }}>
        <span className="inline" style={{ gap: 8, color: "var(--danger)", fontWeight: 700 }}>
          <AlertTriangle size={18} /> {title}
        </span>
        <p className="small" style={{ color: "var(--ink-2)" }}>{message}</p>
        <div className="inline">
          {retry && (
            <button className="btn-primary btn-sm" onClick={() => window.location.reload()}>
              <RotateCw size={14} /> もう一度読み込む
            </button>
          )}
          <Link href="/mypage" className="btn-secondary btn-sm">
            ホームへ
          </Link>
        </div>
      </div>
    </div>
  );
}
