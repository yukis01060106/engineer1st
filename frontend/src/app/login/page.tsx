"use client";

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api/client";
import { Brand } from "../../components/Brand";
import { AuthVisual } from "../../components/AuthVisual";

// 外部サイトへのリダイレクトを防ぐ（同一サイト内のパスだけ許可）
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.push(next ?? (user.role === "admin" ? "/admin" : "/mypage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <Brand />
      <div>
        <h1>おかえりなさい</h1>
        <p className="auth-subtitle">ログインして、部活・勉強会・請求や備えの続きを。</p>
      </div>
      <label>
        メールアドレス
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
      </label>
      <label>
        パスワード
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn-primary btn-lg" type="submit" disabled={submitting}>
        {submitting ? "ログイン中…" : "ログイン"} <ArrowRight size={18} />
      </button>
      <p className="auth-switch">
        はじめての方は <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>無料で登録</Link>
      </p>
      <div className="auth-hint">
        デモ：tanaka@example.com / password123
        <br />
        運営デモ：admin@example.com / password123
        <div className="inline" style={{ justifyContent: "center", marginTop: 8 }}>
          <button type="button" className="chip" onClick={() => { setEmail("tanaka@example.com"); setPassword("password123"); }}>
            会員で試す
          </button>
          <button type="button" className="chip" onClick={() => { setEmail("admin@example.com"); setPassword("password123"); }}>
            運営で試す
          </button>
        </div>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-page">
      <AuthVisual title="今週の部活、もう申し込んだ？" body="ピックルボール部は第2・第4土曜の10時から。未経験でもすぐラリーが続きます。" />
      <main className="auth-main">
        <Suspense fallback={<div className="loading-screen">読み込み中…</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
