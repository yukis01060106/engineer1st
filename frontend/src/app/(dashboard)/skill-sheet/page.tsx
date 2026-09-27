"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Check, Copy, Download, FileText, ListChecks, Plus, Sparkles, Trash2, UserRound, Wrench } from "lucide-react";
import { apiFetch, ApiError, downloadFile } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface SkillItem {
  name: string;
  level: number;
  years: number;
}
interface ExperienceItem {
  title: string;
  period: string;
  role: string;
  tech: string;
  description: string;
}
interface SkillSheetData {
  summary: string;
  skills: SkillItem[];
  experiences: ExperienceItem[];
  age: number | null;
  nearestStation: string | null;
  availability: string | null;
  desiredRate: number | null;
  totalExperienceYears: number | null;
  workProcesses: string[];
  appealPoints: string[];
  remarks: string | null;
}

const emptySkill: SkillItem = { name: "", level: 3, years: 1 };
const emptyExperience: ExperienceItem = { title: "", period: "", role: "", tech: "", description: "" };

const WORK_PROCESS_OPTIONS = [
  "企画",
  "要件定義",
  "設計",
  "開発（フロントエンド）",
  "開発（バックエンド）",
  "開発（インフラ）",
  "テスト",
  "運用保守",
];

const LEVELS: Record<number, string> = {
  1: "学習中・触ったことがある",
  2: "指示があれば実装できる",
  3: "ひとりで実装できる",
  4: "設計からリードできる",
  5: "チームに教えられる・第一人者",
};

export default function SkillSheetPage() {
  const [skills, setSkills] = useState<SkillItem[]>([{ ...emptySkill }]);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([{ ...emptyExperience }]);
  const [age, setAge] = useState("");
  const [nearestStation, setNearestStation] = useState("");
  const [availability, setAvailability] = useState("");
  const [desiredRate, setDesiredRate] = useState("");
  const [totalExperienceYears, setTotalExperienceYears] = useState("");
  const [workProcesses, setWorkProcesses] = useState<string[]>([]);
  const [appealPoints, setAppealPoints] = useState<string[]>([""]);
  const [remarks, setRemarks] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasSheet, setHasSheet] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<{ skillSheet: SkillSheetData | null }>("/skill-sheet").then((res) => {
      setLoaded(true);
      if (res.skillSheet) {
        setHasSheet(true);
        setSkills(res.skillSheet.skills.length ? res.skillSheet.skills : [{ ...emptySkill }]);
        setExperiences(
          res.skillSheet.experiences.length ? res.skillSheet.experiences : [{ ...emptyExperience }]
        );
        setAge(res.skillSheet.age?.toString() ?? "");
        setNearestStation(res.skillSheet.nearestStation ?? "");
        setAvailability(res.skillSheet.availability ?? "");
        setDesiredRate(res.skillSheet.desiredRate?.toString() ?? "");
        setTotalExperienceYears(res.skillSheet.totalExperienceYears?.toString() ?? "");
        setWorkProcesses(res.skillSheet.workProcesses ?? []);
        setAppealPoints(res.skillSheet.appealPoints.length ? res.skillSheet.appealPoints : [""]);
        setRemarks(res.skillSheet.remarks ?? "");
        setSummary(res.skillSheet.summary);
      } else {
        // 初回登録時のみ：登録済みの稼働情報からヒアリング不要な項目を自動入力する
        apiFetch<{ defaults: { desiredRate: number | null; availability: string; totalExperienceYears: number | null } }>(
          "/skill-sheet/defaults"
        ).then((res) => {
          if (res.defaults.desiredRate) setDesiredRate(String(res.defaults.desiredRate));
          setAvailability(res.defaults.availability);
          if (res.defaults.totalExperienceYears) setTotalExperienceYears(String(res.defaults.totalExperienceYears));
        });
      }
    });
  }, []);

  function toggleWorkProcess(process: string) {
    setWorkProcesses((prev) =>
      prev.includes(process) ? prev.filter((p) => p !== process) : [...prev, process]
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ skillSheet: SkillSheetData }>("/skill-sheet", {
        method: "POST",
        body: JSON.stringify({
          skills: skills.filter((s) => s.name.trim()),
          experiences: experiences.filter((e) => e.title.trim()),
          age: age ? Number(age) : null,
          nearestStation: nearestStation || null,
          availability: availability || null,
          desiredRate: desiredRate ? Number(desiredRate) : null,
          totalExperienceYears: totalExperienceYears ? Number(totalExperienceYears) : null,
          workProcesses,
          appealPoints: appealPoints.filter((p) => p.trim()),
          remarks: remarks || null,
        }),
      });
      setSummary(res.skillSheet.summary);
      setHasSheet(true);
      setMessage({ ok: true, text: "保存しました。サマリーシートを作り直しました。" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : "保存できませんでした" });
    } finally {
      setSaving(false);
    }
  }

  async function downloadExcel() {
    setMessage(null);
    try {
      await downloadFile("/skill-sheet/excel", "スキルシート.xlsx");
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "ダウンロードできませんでした" });
    }
  }

  async function copySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  const updateSkill = (i: number, patch: Partial<SkillItem>) => setSkills(skills.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const updateExp = (i: number, patch: Partial<ExperienceItem>) => setExperiences(experiences.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  // 埋まり具合（営業担当に渡せる状態かの目安）
  const checks = [
    { label: "基本情報", done: !!(age && nearestStation && availability && desiredRate) },
    { label: "対応可能工程", done: workProcesses.length > 0 },
    { label: "保有スキル3つ以上", done: skills.filter((x) => x.name.trim()).length >= 3 },
    { label: "プロジェクト経歴", done: experiences.some((x) => x.title.trim() && x.description.trim()) },
    { label: "アピールポイント", done: appealPoints.some((p) => p.trim()) },
  ];
  const doneCount = checks.filter((c) => c.done).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Skill Sheet"
        title="スキルシート"
        description={<>わかっている情報（単価・稼働開始時期・経験年数など）は自動で入れています。足りないところだけ埋めて保存すると、Excelのスキルシートと、そのまま送れる文章のサマリーが出来上がります。</>}
      />

      {!loaded && <div className="skeleton" style={{ height: 240 }} />}

      {loaded && (
        <div className="grid-main-side">
          <div className="stack-lg">
            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <UserRound size={18} /> 基本情報
                </h2>
              </div>
              <div className="form-grid">
                <label>
                  年齢
                  <input type="number" min={16} max={90} value={age} onChange={(e) => setAge(e.target.value)} placeholder="例：32" />
                </label>
                <label>
                  稼働開始
                  <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="例：即日／2026-11〜" />
                </label>
                <label>
                  希望単価（円・月）
                  <input type="number" min={0} step={10000} value={desiredRate} onChange={(e) => setDesiredRate(e.target.value)} placeholder="例：700000" />
                </label>
                <label>
                  IT経験年数
                  <input type="number" min={0} max={60} value={totalExperienceYears} onChange={(e) => setTotalExperienceYears(e.target.value)} placeholder="スキルから自動で計算" />
                </label>
              </div>
              <label>
                最寄駅・希望の働き方
                <input value={nearestStation} onChange={(e) => setNearestStation(e.target.value)} placeholder="例：東京都 ※フルリモート希望（月1回は出社可）" maxLength={100} />
              </label>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <ListChecks size={18} /> 対応できる工程
                </h2>
              </div>
              <div className="chips">
                {WORK_PROCESS_OPTIONS.map((process) => (
                  <button type="button" key={process} className="chip" aria-pressed={workProcesses.includes(process)} onClick={() => toggleWorkProcess(process)}>
                    {workProcesses.includes(process) && <Check size={14} />} {process}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Wrench size={18} /> 保有スキル
                </h2>
                <span className="small muted">案件のマッチ度・スキルギャップに使われます</span>
              </div>
              {skills.map((sk, i) => (
                <div className="skill-row" key={i}>
                  <label>
                    <span className="sr-only">スキル名</span>
                    <input placeholder="スキル名（例：TypeScript）" value={sk.name} onChange={(e) => updateSkill(i, { name: e.target.value })} maxLength={40} />
                  </label>
                  <label>
                    <span className="sr-only">レベル</span>
                    <select value={sk.level} onChange={(e) => updateSkill(i, { level: Number(e.target.value) })} title={LEVELS[sk.level]}>
                      {[1, 2, 3, 4, 5].map((l) => (
                        <option key={l} value={l}>
                          Lv.{l}　{LEVELS[l]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="skill-years">
                    <span className="sr-only">経験年数</span>
                    <input type="number" min={0} max={50} value={sk.years} onChange={(e) => updateSkill(i, { years: Number(e.target.value) })} />
                    <span className="small muted">年</span>
                  </label>
                  <button type="button" className="plan-delete" onClick={() => setSkills(skills.filter((_, idx) => idx !== i))} aria-label={`${sk.name || "このスキル"}を削除`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setSkills([...skills, { ...emptySkill }])}>
                <Plus size={14} /> スキルを追加
              </button>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Briefcase size={18} /> プロジェクト経歴
                </h2>
                <span className="small muted">新しい順に</span>
              </div>
              {experiences.map((exp, i) => (
                <div className="experience-form" key={i} style={{ marginBottom: 0 }}>
                  <div className="spread">
                    <strong className="small">経歴 {i + 1}</strong>
                    <button type="button" className="plan-delete" onClick={() => setExperiences(experiences.filter((_, idx) => idx !== i))} aria-label={`経歴${i + 1}を削除`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <label>
                    案件名
                    <input placeholder="例：大手ECサイト リプレイス" value={exp.title} onChange={(e) => updateExp(i, { title: e.target.value })} />
                  </label>
                  <div className="form-grid">
                    <label>
                      期間
                      <input placeholder="例：2025-04〜稼働中" value={exp.period} onChange={(e) => updateExp(i, { period: e.target.value })} />
                    </label>
                    <label>
                      役割
                      <input placeholder="例：フロントエンドエンジニア" value={exp.role} onChange={(e) => updateExp(i, { role: e.target.value })} />
                    </label>
                  </div>
                  <label>
                    使った技術
                    <input placeholder="例：React, TypeScript, AWS" value={exp.tech} onChange={(e) => updateExp(i, { tech: e.target.value })} />
                  </label>
                  <label>
                    担当したこと
                    <textarea placeholder="例：コンポーネント設計とAPI連携を担当。表示速度を40%改善。" value={exp.description} onChange={(e) => updateExp(i, { description: e.target.value })} rows={3} />
                  </label>
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setExperiences([...experiences, { ...emptyExperience }])}>
                <Plus size={14} /> 経歴を追加
              </button>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Sparkles size={18} /> アピールポイントと備考
                </h2>
              </div>
              {appealPoints.map((point, i) => (
                <div className="inline" key={i} style={{ flexWrap: "nowrap" }}>
                  <input
                    placeholder="例：TypeScript / React を軸に、画面からAPIまでひとりで担当できる"
                    value={point}
                    onChange={(e) => setAppealPoints(appealPoints.map((p, idx) => (idx === i ? e.target.value : p)))}
                    aria-label={`アピールポイント${i + 1}`}
                  />
                  <button type="button" className="plan-delete" onClick={() => setAppealPoints(appealPoints.filter((_, idx) => idx !== i))} aria-label={`アピールポイント${i + 1}を削除`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setAppealPoints([...appealPoints, ""])}>
                <Plus size={14} /> アピールポイントを追加
              </button>
              <label>
                備考・PR
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="ほかに伝えたいことがあれば自由に" rows={3} maxLength={2000} />
              </label>
            </section>
          </div>

          <aside className="stack skill-aside">
            <section className="panel stack">
              <div className="panel-head">
                <h2>埋まり具合</h2>
                <span className="small">
                  <strong className="num">{doneCount}</strong> / {checks.length}
                </span>
              </div>
              <div className="bar">
                <span style={{ width: `${(doneCount / checks.length) * 100}%`, background: doneCount === checks.length ? "var(--success)" : "var(--primary)" }} />
              </div>
              <ul className="plan-list" style={{ marginTop: 0 }}>
                {checks.map((c) => (
                  <li key={c.label} className="small" style={{ padding: "6px 0" }}>
                    {c.done ? <Check size={16} style={{ color: "var(--success)" }} /> : <span style={{ width: 16, display: "inline-block", textAlign: "center" }}>・</span>}
                    <span className={c.done ? "" : "muted"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {message && <div className={message.ok ? "form-success" : "form-error"} role="status">{message.text}</div>}
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                <FileText size={16} /> {saving ? "作成中…" : hasSheet ? "保存してサマリーを作り直す" : "保存してサマリーを作る"}
              </button>
              {hasSheet && (
                <button className="btn-secondary" onClick={downloadExcel}>
                  <Download size={16} /> Excelでダウンロード
                </button>
              )}
            </section>

            {summary && (
              <section className="panel stack">
                <div className="panel-head">
                  <h2>サマリー</h2>
                  <button className="btn-ghost btn-sm" onClick={copySummary}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "コピーしました" : "コピー"}
                  </button>
                </div>
                <pre className="summary-text" style={{ margin: 0, maxHeight: 420, overflow: "auto" }}>{summary}</pre>
                <Link href="/projects" className="btn-link small">
                  このスキルに合う案件を見る
                </Link>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
