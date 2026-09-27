"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../api/client";

// 未ログインなら「無料登録して入部」（登録と同時に入部させる）。ログイン済みならその場で入部・退部
export function ClubJoinButton({ slug, name }: { slug: string; name: string }) {
  const { user, loading } = useAuth();
  const [joined, setJoined] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ club: { joined: boolean } }>(`/clubs/${slug}`)
      .then((r) => setJoined(r.club.joined))
      .catch(() => setJoined(false));
  }, [user, slug]);

  if (loading) return <div className="skeleton" style={{ height: 56, width: 260 }} />;

  if (!user) {
    return (
      <div className="stack">
        <Link href={`/register?club=${slug}`} className="btn-primary btn-lg">
          無料登録して{name}に入る <ArrowRight size={18} />
        </Link>
        <p className="small muted">
          すでに会員の方は <Link href={`/login?next=/clubs/${slug}`} className="btn-link">ログイン</Link>
        </p>
      </div>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/clubs/${slug}/join`, { method: joined ? "DELETE" : "POST" });
      setJoined(!joined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  }

  if (joined === null) return <div className="skeleton" style={{ height: 56, width: 260 }} />;

  return (
    <div className="stack">
      {joined ? (
        <div className="inline">
          <span className="badge badge-success" style={{ padding: "8px 14px", fontSize: 13 }}>
            <Check size={14} /> 入部しています
          </span>
          <button className="btn-ghost btn-sm" onClick={toggle} disabled={busy}>
            退部する
          </button>
        </div>
      ) : (
        <button className="btn-primary btn-lg" onClick={toggle} disabled={busy}>
          {name}に入る <ArrowRight size={18} />
        </button>
      )}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
