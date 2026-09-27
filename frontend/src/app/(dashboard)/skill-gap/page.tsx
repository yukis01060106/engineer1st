"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarDays, FileText, TrendingUp } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { PageError } from "../../../components/PageError";
import { EventDate } from "../../../components/EventDate";

interface Gap {
  name: string;
  marketDemand: number;
  myLevel: number;
  gap: number;
  tip: string;
}

interface Project {
  skills: string;
  unitPrice: number;
}

interface EventItem {
  id: string;
  title: string;
  date: string;
  tags: string;
}

const hasSkill = (csv: string, name: string) => csv.split(",").some((s) => s.trim().toLowerCase() === name.toLowerCase());

export default function SkillGapPage() {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [hasSheet, setHasSheet] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ gaps: Gap[]; hasSkillSheet: boolean }>("/skill-gap")
      .then((res) => {
        setGaps(res.gaps);
        setHasSheet(res.hasSkillSheet);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "読み込めませんでした"));
    apiFetch<{ projects: Project[] }>("/projects").then((r) => setProjects(r.projects)).catch(() => undefined);
    apiFetch<{ events: EventItem[] }>("/events").then((r) => setEvents(r.events)).catch(() => undefined);
  }, []);

  if (error) return <PageError message={error} />;

  const focus = (gaps ?? []).filter((g) => g.gap > 0).slice(0, 3);
  const strong = (gaps ?? []).filter((g) => g.gap <= 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Skill Gap"
        title="スキルギャップ"
        description={<>案件で求められることが多いスキルと、スキルシートに登録したあなたのレベルを比べます。次に何を伸ばすと案件の選択肢が広がるかの目安にしてください。</>}
      />

      {!hasSheet && (
        <section className="panel" style={{ background: "var(--yellow-soft)", borderColor: "transparent" }}>
          <div className="spread">
            <div className="stack" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 17 }}>まずはスキルシートに、保有スキルを登録しましょう</h2>
              <p className="small">いまはスキルが未登録なので、すべて「0」で表示しています。登録すると、あなたとの差が出ます。</p>
            </div>
            <Link href="/skill-sheet" className="btn-primary">
              <FileText size={16} /> スキルシートへ
            </Link>
          </div>
        </section>
      )}

      {!gaps && <div className="skeleton" style={{ height: 320 }} />}

      {gaps && hasSheet && focus.length > 0 && (
        <section className="stack">
          <h2 style={{ fontSize: 17 }} className="inline">
            <TrendingUp size={18} /> 次に伸ばすと効きそうなスキル
          </h2>
          <div className="grid-3">
            {focus.map((g, i) => {
              const related = projects.filter((p) => hasSkill(p.skills, g.name));
              const top = related.reduce((m, p) => Math.max(m, p.unitPrice), 0);
              const ev = events.find((e) => hasSkill(e.tags, g.name));
              return (
                <article className="panel stack" key={g.name} style={{ gap: 10 }}>
                  <div className="spread">
                    <span className="eyebrow">No.{i + 1}</span>
                    <span className="badge badge-violet">差 {g.gap}</span>
                  </div>
                  <h3 className="en" style={{ fontSize: 20 }}>{g.name}</h3>
                  <p className="small" style={{ color: "var(--ink-2)" }}>{g.tip}</p>
                  {related.length > 0 && (
                    <Link href={`/projects?q=${encodeURIComponent(g.name)}`} className="btn-link small">
                      <Briefcase size={14} /> 使う案件 {related.length}件（最高 {Math.round(top / 10_000)}万円／月）
                    </Link>
                  )}
                  {ev && (
                    <Link href={`/events/${ev.id}`} className="schedule-item" style={{ paddingBlock: 6 }}>
                      <EventDate date={ev.date} />
                      <span className="small" style={{ fontWeight: 700 }}>{ev.title}</span>
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {gaps && (
        <section className="panel">
          <div className="panel-head">
            <h2>市場の需要とあなたのレベル</h2>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-swatch market" /> 市場の需要
              </span>
              <span className="legend-item">
                <span className="legend-swatch mine" /> あなた
              </span>
            </div>
          </div>
          <div className="skillgap-list">
            {gaps.map((g) => (
              <div className="skillgap-row" key={g.name}>
                <div className="skillgap-name">{g.name}</div>
                <div className="skillgap-bar-track" role="img" aria-label={`${g.name}: 需要${g.marketDemand}、あなた${g.myLevel}`}>
                  <div className="skillgap-bar-market" style={{ width: `${g.marketDemand}%` }} />
                  <div className="skillgap-bar-mine" style={{ width: `${Math.min(100, g.myLevel)}%` }} />
                </div>
                <div className="skillgap-values num">
                  需要 {g.marketDemand} / あなた {g.myLevel}
                  {g.gap <= 0 && <span className="badge badge-mint" style={{ marginLeft: 6 }}>強み</span>}
                </div>
              </div>
            ))}
          </div>
          {strong.length > 0 && (
            <p className="small" style={{ marginTop: 16 }}>
              <strong>{strong.map((g) => g.name).join("・")}</strong> は需要を上回っています。スキルシートの自己PRで前に出しましょう。
            </p>
          )}
        </section>
      )}

      <div className="spread">
        <p className="disclaimer">需要は、ソトバの案件と公開求人をもとにした目安（0〜100）です。あなたのレベルは、スキルシートの5段階評価を100点に換算しています。</p>
        <Link href="/events" className="btn-secondary btn-sm">
          <CalendarDays size={14} /> 勉強会をさがす <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
