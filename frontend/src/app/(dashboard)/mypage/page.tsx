"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  FileSignature,
  FileText,
  HeartPulse,
  Landmark,
  Receipt,
  Video,
  MapPin,
  PiggyBank,
  Calculator,
  Gauge,
  Briefcase,
  Users,
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Share2,
} from "lucide-react";
import { apiFetch } from "../../../api/client";
import { MembershipCard } from "../../../components/MembershipCard";
import { InviteButton } from "../../../components/InviteButton";
import { EventDate } from "../../../components/EventDate";
import { yen, man, pct, dateParts } from "../../../lib/format";
import { asset } from "../../../lib/demo";

interface Alert {
  type: string;
  tone: "urgent" | "normal" | "info";
  message: string;
  actionLabel: string;
  actionPath: string;
  recommendedProjects?: { id: string; title: string; unitPrice: number; matchScore: number }[];
}

interface OnboardingStep {
  key: string;
  title: string;
  why: string;
  path: string;
  done: boolean;
}

interface MyPageData {
  onboarding: { steps: OnboardingStep[]; doneCount: number; total: number; completed: boolean };
  referralCount: number;
  user: { name: string; joinedAt: string; memberNumber: string; workStyle: string; interests: string[] };
  rank: { current: string; tenureYears: number };
  currentEngagement: { monthlyRate: number; endDate: string | null; project: { title: string; client: string } } | null;
  hasSkillSheet: boolean;
  alerts: Alert[];
  clubs: { slug: string; name: string; color: string; photo: string }[];
  upcomingEvents: { id: string; title: string; type: string; date: string; location: string; isOnline: boolean; joinUrl: string | null; club: { name: string } | null }[];
}

interface MoneySummary {
  outstandingAmount: number;
  overdueCount: number;
  paidThisYear: number;
}

const ALERT_ICON: Record<string, typeof AlertTriangle> = {
  engagement_ending: CalendarClock,
  payment_overdue: AlertTriangle,
  invoice_due: Receipt,
  tax_season: Landmark,
  checkup_due: HeartPulse,
  contract_unsigned: FileSignature,
  event_upcoming: BellRing,
  skill_sheet_missing: FileText,
};

function greeting() {
  const h = Number(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }).format(new Date()));
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "おつかれさまです";
}

function Welcome() {
  const params = useSearchParams();
  const welcome = params.get("welcome");
  const [show, setShow] = useState(!!welcome);
  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, [welcome]);
  if (!show || !welcome) return null;
  return <div className="toast" role="status">🎉 {welcome}に入部しました</div>;
}

export default function MyPage() {
  const [data, setData] = useState<MyPageData | null>(null);
  const [money, setMoney] = useState<MoneySummary | null>(null);
  const [reserveRate, setReserveRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MyPageData>("/mypage")
      .then((d) => {
        setData(d);
        if (d.user.workStyle === "freelance") {
          apiFetch<{ summary: MoneySummary }>("/money/invoices").then((r) => setMoney(r.summary));
          apiFetch<{ result: { reserveRate: number } }>("/money/tax-reserve").then((r) => setReserveRate(r.result.reserveRate));
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page-error">{error}</div>;
  if (!data) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  const { user, rank, currentEngagement, alerts } = data;
  const isFreelance = user.workStyle === "freelance";

  const quick = [
    ...(isFreelance
      ? [{ to: "/money", label: "請求書をつくる", icon: Receipt, bg: "var(--yellow)" }]
      : [{ to: "/reward-sim", label: "独立したら手取りは？", icon: Calculator, bg: "var(--yellow)" }]),
    { to: "/wealth", label: "AI FPに相談", icon: PiggyBank, bg: "var(--pink)" },
    { to: "/health", label: "コンディション記録", icon: HeartPulse, bg: "var(--mint-soft)" },
    { to: "/rate-diagnosis", label: "単価を診断", icon: Gauge, bg: "var(--violet-soft)" },
    { to: "/projects", label: "案件をさがす", icon: Briefcase, bg: "var(--paper-2)" },
  ];

  return (
    <div className="page">
      <Suspense>
        <Welcome />
      </Suspense>

      <section className="home-hero">
        <div className="home-greet">
          <span className="eyebrow">Home</span>
          <h1>
            {greeting()}、
            <br />
            {user.name}さん
          </h1>
          <p className="page-desc">
            {currentEngagement
              ? `「${currentEngagement.project.title}」で稼働中。${alerts.length > 0 ? `今日は${alerts.length}件のお知らせがあります。` : "今日のお知らせはありません。"}`
              : "部活・勉強会・事務や備えのツールを、気が向いたときに使ってください。"}
          </p>
        </div>
        <MembershipCard name={user.name} rank={rank.current} memberNumber={user.memberNumber} joinedAt={user.joinedAt} />
      </section>

      {!data.onboarding.completed && (
        <section className="panel onboarding">
          <div className="panel-head">
            <h2>
              <Sparkles size={18} /> はじめの一歩
            </h2>
            <span className="small">
              <strong className="num">{data.onboarding.doneCount}</strong> / {data.onboarding.total} 完了
            </span>
          </div>
          <div className="bar">
            <span style={{ width: `${(data.onboarding.doneCount / data.onboarding.total) * 100}%`, background: "var(--primary)" }} />
          </div>
          <ol className="onboarding-list">
            {data.onboarding.steps.map((s) => (
              <li key={s.key} className={s.done ? "is-done" : ""}>
                {s.done ? <CheckCircle2 size={20} className="ok" /> : <Circle size={20} />}
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.why}</span>
                </div>
                {!s.done && (
                  <Link href={s.path} className="btn-secondary btn-sm">
                    やる <ArrowRight size={14} />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid-main-side">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <BellRing size={18} /> やること
            </h2>
            <span className="small muted">{alerts.length}件</span>
          </div>
          {alerts.length === 0 ? (
            <div className="empty-state">いまは、やることはありません 🎉</div>
          ) : (
            <div className="todo-list">
              {alerts.map((a, i) => {
                const Icon = ALERT_ICON[a.type] ?? BellRing;
                return (
                  <div key={i} className={`todo todo-${a.tone}`}>
                    <span className="todo-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <div className="todo-msg">{a.message}</div>
                      {a.recommendedProjects && a.recommendedProjects.length > 0 && (
                        <div className="todo-recommend">
                          {a.recommendedProjects.map((p) => (
                            <Link href="/projects" key={p.id}>
                              <span>{p.title}</span>
                              <span className="num muted">
                                {man(p.unitPrice)}・マッチ{p.matchScore}%
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link href={a.actionPath} className="btn-secondary btn-sm">
                      {a.actionLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>
                <CalendarClock size={18} /> 次の予定
              </h2>
              <Link href="/community" className="btn-link small">
                すべて
              </Link>
            </div>
            {data.upcomingEvents.length === 0 ? (
              <div className="stack">
                <p className="small muted">申し込んだ勉強会・部活の活動はまだありません。</p>
                <Link href="/community" className="btn-secondary btn-sm" style={{ justifySelf: "start" }}>
                  予定をさがす <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div>
                {data.upcomingEvents.map((e) => (
                  <div className="schedule-item" key={e.id}>
                    <EventDate date={e.date} />
                    <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                      <Link href={`/events/${e.id}`} style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>
                        {e.title}
                      </Link>
                      <div className="event-meta">
                        <span>{dateParts(e.date).time}〜</span>
                        <span>
                          {e.isOnline ? <Video size={13} /> : <MapPin size={13} />} {e.location}
                        </span>
                      </div>
                      {e.joinUrl && (
                        <a href={e.joinUrl} target="_blank" rel="noopener noreferrer" className="btn-link small">
                          参加URLを開く <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>
                <Users size={18} /> 入っている部活
              </h2>
            </div>
            {data.clubs.length === 0 ? (
              <div className="stack">
                <p className="small muted">まだ部活に入っていません。体を動かしながら、仲間をつくりませんか。</p>
                <Link href="/clubs" className="btn-primary btn-sm" style={{ justifySelf: "start" }}>
                  部活を見る <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div>
                {data.clubs.map((c) => (
                  <Link href={`/clubs/${c.slug}`} className="mini-club" key={c.slug}>
                    <Image src={asset(`/photos/${c.photo}`)} alt="" width={52} height={52} />
                    <strong>{c.name}</strong>
                    <ArrowRight size={16} style={{ marginLeft: "auto" }} />
                  </Link>
                ))}
                <Link href="/clubs" className="btn-link small" style={{ marginTop: 8 }}>
                  ほかの部活も見る
                </Link>
              </div>
            )}
          </section>

          <section className="panel" style={{ background: "var(--pink-soft)", borderColor: "transparent" }}>
            <div className="panel-head">
              <h2>
                <Share2 size={18} /> 仲間を誘う
              </h2>
              {data.referralCount > 0 && <span className="badge badge-pink">{data.referralCount}人が参加</span>}
            </div>
            <p className="small">現場の同僚や、独立を考えている友だちに。あなたの招待リンクから登録すると、部活でいっしょに活動できます。</p>
            <InviteButton
              path="/clubs/"
              title="エンジニア1st"
              text="エンジニア向けの部活と勉強会、いっしょにどう？ 参加は無料だよ。"
              label="招待リンクを送る"
              className="btn-primary btn-sm"
            />
          </section>
        </div>
      </div>

      {isFreelance && !currentEngagement && (
        <section className="panel" style={{ background: "var(--yellow-soft)", borderColor: "transparent" }}>
          <div className="spread">
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Paperwork</span>
              <h2>いまの取引先を登録して、請求と入金をラクに</h2>
              <p className="small">
                エンジニア1st以外で見つけた案件でもOK。稼働時間を入れるだけの請求書づくり、支払期日のチェック、契約終了45日前のお知らせが使えるようになります。
              </p>
            </div>
            <Link href="/money#engagement" className="btn-primary">
              取引先を登録する <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {isFreelance && currentEngagement && money && (
        <section className="panel">
          <div className="panel-head">
            <h2>
              <Receipt size={18} /> 請求と備えのようす
            </h2>
            <Link href="/money" className="btn-link small">
              請求・入金へ <ArrowRight size={14} />
            </Link>
          </div>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-label">未入金</div>
              <div className="stat-value">{man(money.outstandingAmount).replace("万円", "")}<small>万円</small></div>
              {money.overdueCount > 0 && <div className="stat-sub" style={{ color: "var(--danger)", fontWeight: 700 }}>期日超過 {money.overdueCount}件</div>}
            </div>
            <div className="stat-tile">
              <div className="stat-label">今年の入金（税抜）</div>
              <div className="stat-value">{man(money.paidThisYear).replace("万円", "")}<small>万円</small></div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">税金の取り分け目安</div>
              <div className="stat-value">{reserveRate != null ? pct(reserveRate).replace("%", "") : "—"}<small>%</small></div>
              <div className="stat-sub">入金のたびに別口座へ</div>
            </div>
            {currentEngagement && (
              <div className="stat-tile">
                <div className="stat-label">稼働中の月単価</div>
                <div className="stat-value">{man(currentEngagement.monthlyRate).replace("万円", "")}<small>万円</small></div>
                <div className="stat-sub">{yen(currentEngagement.monthlyRate)}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {!isFreelance && (
        <section className="panel" style={{ background: "var(--yellow-soft)", borderColor: "transparent" }}>
          <div className="spread">
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">For SES engineers</span>
              <h2>いまの年収で独立したら、手取りはいくら？</h2>
              <p className="small">いまの年収を入れるだけで、フリーランスになった場合の手取りと比べられます（概算）。</p>
            </div>
            <Link href="/reward-sim" className="btn-primary">
              比べてみる <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      <section className="stack">
        <h2 style={{ fontSize: 17 }}>よく使う</h2>
        <div className="quick-grid">
          {quick.map((q) => (
            <Link href={q.to} className="quick" key={q.to}>
              <span className="quick-icon" style={{ background: q.bg }}>
                <q.icon size={20} />
              </span>
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
