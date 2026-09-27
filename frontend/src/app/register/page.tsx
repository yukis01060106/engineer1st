"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Compass, HeartPulse, BookOpen, Wallet, TrendingUp, Sparkles } from "lucide-react";
import { useAuth, WorkStyle } from "../../context/AuthContext";
import { apiFetch, ApiError } from "../../api/client";
import { Brand } from "../../components/Brand";
import { getReferral, clearReferral } from "../../lib/referral";
import { AuthVisual } from "../../components/AuthVisual";

const WORK_STYLES: { value: WorkStyle; title: string; body: string; icon: typeof Briefcase; bg: string }[] = [
  { value: "freelance", title: "フリーランス", body: "業務委託で働いている", icon: Briefcase, bg: "var(--yellow)" },
  { value: "ses_employee", title: "SES企業の会社員", body: "正社員として客先に常駐している", icon: Building2, bg: "var(--mint-soft)" },
  { value: "considering", title: "独立を考え中", body: "いつかフリーランスになりたい", icon: Compass, bg: "var(--pink)" },
];

const INTERESTS = [
  { value: "health", label: "運動・健康", icon: HeartPulse },
  { value: "study", label: "勉強会", icon: BookOpen },
  { value: "money", label: "事務・税金・将来の備え", icon: Wallet },
  { value: "career", label: "単価・キャリア", icon: TrendingUp },
];

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const clubSlug = params.get("club") ?? undefined;
  const eventId = params.get("event") ?? undefined;
  const next = safeNext(params.get("next"));
  const presetStyle = params.get("style") as WorkStyle | null;

  const [step, setStep] = useState(0);
  const [workStyle, setWorkStyle] = useState<WorkStyle | null>(
    presetStyle && ["freelance", "ses_employee", "considering"].includes(presetStyle) ? presetStyle : null
  );
  const [interests, setInterests] = useState<string[]>(clubSlug ? ["health"] : eventId ? ["study"] : []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clubName, setClubName] = useState<string | null>(null);

  useEffect(() => {
    if (!clubSlug) return;
    // 準備中の部活は入部できないので、案内を出さない
    apiFetch<{ club: { name: string; status: string } }>(`/clubs/${clubSlug}`)
      .then((r) => setClubName(r.club.status === "open" ? r.club.name : null))
      .catch(() => setClubName(null));
  }, [clubSlug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workStyle) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await register({ email, password, name, workStyle, interests, clubSlug, eventId, referrerId: getReferral() });
      clearReferral();
      const dest = next ?? (eventId ? `/events/${eventId}` : "/mypage");
      router.push(res.joinedClub ? `${dest}${dest.includes("?") ? "&" : "?"}welcome=${encodeURIComponent(res.joinedClub)}` : dest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <Brand />
      <div className="stepper" aria-label={`ステップ ${step + 1} / 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i <= step ? "is-done" : ""} />
        ))}
      </div>

      {clubName && (
        <div className="auth-context">
          <Sparkles size={18} /> 登録すると、そのまま「{clubName}」に入部します
        </div>
      )}
      {eventId && !clubName && (
        <div className="auth-context">
          <Sparkles size={18} /> 登録後、申し込みページに戻ります
        </div>
      )}

      {step === 0 && (
        <>
          <div>
            <h1>いまの働き方は？</h1>
            <p className="auth-subtitle">あとから設定で変えられます。あなたに合った機能だけを表示します。</p>
          </div>
          <div className="choice-grid" role="radiogroup">
            {WORK_STYLES.map((w) => (
              <button
                type="button"
                key={w.value}
                className="choice"
                role="radio"
                aria-checked={workStyle === w.value}
                onClick={() => setWorkStyle(w.value)}
              >
                <span className="choice-icon" style={{ background: w.bg }}>
                  <w.icon size={20} />
                </span>
                <span>
                  <strong>{w.title}</strong>
                  <span>{w.body}</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary btn-lg" disabled={!workStyle} onClick={() => setStep(1)}>
            次へ <ArrowRight size={18} />
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <div>
            <h1>気になることは？</h1>
            <p className="auth-subtitle">いくつでも。ホーム画面のおすすめに使います。</p>
          </div>
          <div className="chips">
            {INTERESTS.map((i) => {
              const on = interests.includes(i.value);
              return (
                <button
                  type="button"
                  key={i.value}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setInterests(on ? interests.filter((x) => x !== i.value) : [...interests, i.value])}
                >
                  <i.icon size={16} /> {i.label}
                </button>
              );
            })}
          </div>
          <div className="spread">
            <button type="button" className="btn-ghost" onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> 戻る
            </button>
            <button type="button" className="btn-primary btn-lg" onClick={() => setStep(2)}>
              次へ <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <h1>アカウントをつくる</h1>
            <p className="auth-subtitle">無料・営業電話なし。案件の紹介は、必要なときだけアプリ内で。</p>
          </div>
          <label>
            お名前（ニックネーム可）
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={50} required />
          </label>
          <label>
            メールアドレス
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            パスワード <span className="field-hint">8文字以上</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="checkbox-label" style={{ fontWeight: 400, fontSize: 13 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
            <span>
              <Link href="/terms" target="_blank" className="btn-link">利用規約</Link>と
              <Link href="/privacy" target="_blank" className="btn-link">プライバシーポリシー</Link>
              に同意します（入力したデータは、自分の画面をつくるために使われます）
            </span>
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="spread">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> 戻る
            </button>
            <button className="btn-primary btn-lg" type="submit" disabled={submitting || !agree}>
              {submitting ? "登録中…" : "無料で登録する"}
            </button>
          </div>
        </>
      )}

      <p className="auth-switch">
        すでにアカウントをお持ちの方は <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>ログイン</Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <AuthVisual photo="community.webp" title="フリーランスも、SESで働く人も。" body="部活・勉強会・事務や将来の備えのツールが、ぜんぶ無料で使えます。" />
      <main className="auth-main">
        <Suspense fallback={<div className="loading-screen">読み込み中…</div>}>
          <RegisterForm />
        </Suspense>
      </main>
    </div>
  );
}
