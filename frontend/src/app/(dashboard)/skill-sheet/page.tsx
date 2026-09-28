"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Award,
  ChevronRight,
  Briefcase,
  Check,
  Copy,
  Download,
  FileText,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  UserRound,
  Wand2,
  Wrench,
} from "lucide-react";
import {
  PHASES,
  ROLE_OPTIONS,
  ENV_FIELDS,
  EMPTY_EXPERIENCE,
  completeness,
  durationLabel,
  monthsOf,
  totalExperienceMonths,
  type Experience,
  type Qualification,
  type SkillItem,
  type SkillSheetSource,
} from "@shared/skillSheet";
import { categorizeSkill } from "@shared/skillCategory";
import { apiFetch, ApiError, downloadFile } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { useAuth } from "../../../context/AuthContext";
import { IS_DEMO } from "../../../lib/demo";

const LEVELS: Record<number, string> = {
  1: "学習中",
  2: "指示があれば実装",
  3: "ひとりで実装",
  4: "設計からリード",
  5: "人に教えられる",
};

const ENV_PLACEHOLDER: Record<string, string> = {
  languages: "例：TypeScript, Java",
  frameworks: "例：React, Spring Boot",
  databases: "例：PostgreSQL",
  os: "例：Linux",
  cloud: "例：AWS（ECS, RDS）",
  tools: "例：GitHub, JIRA",
};

const emptySkill: SkillItem = { name: "", level: 3, years: 1 };
const emptyQual: Qualification = { name: "", acquired: "" };

type SheetResponse = SkillSheetSource & { summary: string; updatedAt: string };

export default function SkillSheetPage() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [hasSheet, setHasSheet] = useState(false);
  const [initials, setInitials] = useState("");
  const [showFullName, setShowFullName] = useState(false);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [nearestStation, setNearestStation] = useState("");
  const [availability, setAvailability] = useState("");
  const [desiredRateMan, setDesiredRateMan] = useState("");
  const [totalYears, setTotalYears] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [skills, setSkills] = useState<SkillItem[]>([{ ...emptySkill }]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([{ ...EMPTY_EXPERIENCE }]);
  const [appealPoints, setAppealPoints] = useState<string[]>([""]);
  const [remarks, setRemarks] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // 開いている経歴（番号）。保存済みの経歴は閉じて一行で見せる
  const [openExp, setOpenExp] = useState<Set<number>>(new Set());

  function apply(s: SheetResponse) {
    setInitials(s.initials ?? "");
    setShowFullName(s.showFullName);
    setAge(s.age?.toString() ?? "");
    setGender(s.gender ?? "");
    setNearestStation(s.nearestStation ?? "");
    setAvailability(s.availability ?? "");
    setDesiredRateMan(s.desiredRate ? String(Math.round(s.desiredRate / 10_000)) : "");
    setTotalYears(s.totalExperienceYears?.toString() ?? "");
    setSpecialty(s.specialty ?? "");
    setSkills(s.skills.length ? s.skills : [{ ...emptySkill }]);
    setQualifications(s.qualifications);
    setExperiences(s.experiences.length ? s.experiences : [{ ...EMPTY_EXPERIENCE }]);
    setAppealPoints(s.appealPoints.length ? s.appealPoints : [""]);
    setRemarks(s.remarks ?? "");
    setSummary(s.summary);
  }

  useEffect(() => {
    apiFetch<{ skillSheet: SheetResponse | null }>("/skill-sheet")
      .then((res) => {
        if (res.skillSheet) {
          setHasSheet(true);
          apply(res.skillSheet);
          return;
        }
        // 初回だけ: 登録済みの取引先から、わかっている項目を先に入れる
        return apiFetch<{ defaults: { desiredRate: number | null; availability: string; experiences: Experience[] } }>("/skill-sheet/defaults").then((r) => {
          if (r.defaults.desiredRate) setDesiredRateMan(String(Math.round(r.defaults.desiredRate / 10_000)));
          setAvailability(r.defaults.availability);
          if (r.defaults.experiences.length) setExperiences(r.defaults.experiences);
          setOpenExp(new Set([0]));
        });
      })
      .catch((e) => setMessage({ ok: false, text: e instanceof ApiError ? e.message : "読み込めませんでした" }))
      .finally(() => setLoaded(true));
  }, []);

  // 入力のたびに「変更あり」にする（保存せずに離れようとしたら確認する）
  const touch =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setDirty(true);
      setMessage(null);
    };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const source: SkillSheetSource = useMemo(
    () => ({
      name: user?.name ?? "",
      initials: initials || null,
      showFullName,
      age: age ? Number(age) : null,
      gender: gender || null,
      nearestStation: nearestStation || null,
      availability: availability || null,
      desiredRate: desiredRateMan ? Number(desiredRateMan) * 10_000 : null,
      totalExperienceYears: totalYears ? Number(totalYears) : null,
      specialty: specialty || null,
      qualifications,
      appealPoints,
      remarks: remarks || null,
      skills: skills.filter((s) => s.name.trim()),
      experiences: experiences.filter((e) => e.title.trim()),
    }),
    [user, initials, showFullName, age, gender, nearestStation, availability, desiredRateMan, totalYears, specialty, qualifications, appealPoints, remarks, skills, experiences]
  );
  const check = completeness(source);
  const autoYears = Math.round(totalExperienceMonths(source.experiences) / 12);

  // 経歴の「環境」に書いた技術のうち、スキル欄にまだないもの
  const missingSkills = useMemo(() => {
    const have = new Set(skills.map((s) => s.name.trim().toLowerCase()));
    const found = new Map<string, string>();
    for (const e of experiences) {
      for (const f of ENV_FIELDS) {
        // 「AWS（ECS, Lambda）」のようなかっこ書きは外してから区切る
        for (const raw of e[f.key].replace(/（[^）]*）|\([^)]*\)/g, "").split(/[,、/]/)) {
          const name = raw.trim();
          if (name && !have.has(name.toLowerCase()) && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), name);
        }
      }
    }
    return [...found.values()].slice(0, 12);
  }, [skills, experiences]);

  const updateSkill = (i: number, patch: Partial<SkillItem>) => touch(setSkills)(skills.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const updateExp = (i: number, patch: Partial<Experience>) => touch(setExperiences)(experiences.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const moveExp = (i: number, d: -1 | 1) => {
    const next = [...experiences];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    touch(setExperiences)(next);
    setOpenExp((prev) => {
      const s = new Set(prev);
      const a = s.has(i);
      const b = s.has(i + d);
      s.delete(i);
      s.delete(i + d);
      if (a) s.add(i + d);
      if (b) s.add(i);
      return s;
    });
  };
  const addExp = () => {
    touch(setExperiences)([{ ...EMPTY_EXPERIENCE }, ...experiences]);
    setOpenExp((prev) => new Set([0, ...[...prev].map((n) => n + 1)]));
  };
  const removeExp = (i: number) => {
    touch(setExperiences)(experiences.filter((_, idx) => idx !== i));
    setOpenExp((prev) => new Set([...prev].filter((n) => n !== i).map((n) => (n > i ? n - 1 : n))));
  };
  const toggleExp = (i: number) =>
    setOpenExp((prev) => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      return s;
    });

  async function handleSave() {
    setMessage(null);
    const incomplete = experiences.findIndex((e) => e.title.trim() && !e.startMonth);
    if (incomplete >= 0) {
      setMessage({ ok: false, text: `経歴${incomplete + 1}の開始月を入れてください` });
      setOpenExp((prev) => new Set([...prev, incomplete]));
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ skillSheet: SheetResponse }>("/skill-sheet", {
        method: "POST",
        body: JSON.stringify({
          ...source,
          initials: initials.trim() || null,
          qualifications: qualifications.filter((q) => q.name.trim()),
          appealPoints: appealPoints.filter((p) => p.trim()),
        }),
      });
      apply(res.skillSheet);
      setHasSheet(true);
      setDirty(false);
      setMessage({ ok: true, text: "保存しました。紹介文とスキルシートを作り直しました。" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : "保存できませんでした" });
    } finally {
      setSaving(false);
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

  return (
    <div className="page">
      <PageHeader
        eyebrow="Skill Sheet"
        title="スキルシート"
        description={
          <>
            案件の紹介で使われる一般的な型（基本情報・スキル要約・職務経歴と担当工程）で作ります。保存すると、Excel・印刷用のスキルシートと、メールやチャットにそのまま貼れる紹介文ができあがります。
          </>
        }
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
                  イニシャル <span className="field-hint">紹介ではイニシャル表記が一般的</span>
                  <input value={initials} onChange={(e) => touch(setInitials)(e.target.value)} placeholder="例：Y.A" maxLength={20} disabled={showFullName} />
                </label>
                <label className="checkbox-label" style={{ alignSelf: "end", minHeight: 44 }}>
                  <input type="checkbox" checked={showFullName} onChange={(e) => touch(setShowFullName)(e.target.checked)} />
                  氏名（{user?.name}）をそのまま載せる
                </label>
                <label>
                  年齢
                  <input type="number" min={16} max={90} value={age} onChange={(e) => touch(setAge)(e.target.value)} placeholder="例：32" />
                </label>
                <label>
                  性別 <span className="field-hint">任意</span>
                  <select value={gender} onChange={(e) => touch(setGender)(e.target.value)}>
                    <option value="">載せない</option>
                    <option>男性</option>
                    <option>女性</option>
                    <option>回答しない</option>
                  </select>
                </label>
                <label>
                  稼働開始
                  <input value={availability} onChange={(e) => touch(setAvailability)(e.target.value)} placeholder="例：即日／2026年11月〜" maxLength={50} />
                </label>
                <label>
                  希望単価（万円・月） <span className="field-hint">紹介文にだけ載ります</span>
                  <input type="number" min={0} step={5} value={desiredRateMan} onChange={(e) => touch(setDesiredRateMan)(e.target.value)} placeholder="例：75" />
                </label>
                <label>
                  IT経験年数 <span className="field-hint">{autoYears ? `空欄なら経歴から約${autoYears}年` : "空欄なら経歴から計算"}</span>
                  <input type="number" min={0} max={60} value={totalYears} onChange={(e) => touch(setTotalYears)(e.target.value)} placeholder={autoYears ? String(autoYears) : ""} />
                </label>
              </div>
              <label>
                最寄駅・希望の働き方
                <input value={nearestStation} onChange={(e) => touch(setNearestStation)(e.target.value)} placeholder="例：JR山手線 渋谷駅（フルリモート希望・月1回の出社可）" maxLength={100} />
              </label>
              <label>
                得意分野 <span className="field-hint">一行で。例：Webアプリの設計〜開発、AWSでの構築</span>
                <input value={specialty} onChange={(e) => touch(setSpecialty)(e.target.value)} maxLength={200} />
              </label>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Wrench size={18} /> スキル
                </h2>
                <span className="small muted">言語・FW・DB・OS・クラウドに自動で分類します</span>
              </div>
              {skills.map((sk, i) => (
                <div className="skill-row" key={i}>
                  <label>
                    <span className="sr-only">スキル名</span>
                    <input placeholder="スキル名（例：TypeScript）" value={sk.name} onChange={(e) => updateSkill(i, { name: e.target.value })} maxLength={40} />
                  </label>
                  <label>
                    <span className="sr-only">レベル</span>
                    <select value={sk.level} onChange={(e) => updateSkill(i, { level: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((l) => (
                        <option key={l} value={l}>
                          Lv.{l}　{LEVELS[l]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="skill-years">
                    <span className="sr-only">経験年数</span>
                    <input type="number" min={0} max={50} step={0.5} value={sk.years} onChange={(e) => updateSkill(i, { years: Number(e.target.value) })} />
                    <span className="small muted">年</span>
                  </label>
                  <button type="button" className="plan-delete" onClick={() => touch(setSkills)(skills.filter((_, idx) => idx !== i))} aria-label={`${sk.name || "このスキル"}を削除`}>
                    <Trash2 size={14} />
                  </button>
                  {sk.name.trim() && <span className="skill-cat">{categorizeSkill(sk.name)}</span>}
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => touch(setSkills)([...skills, { ...emptySkill }])}>
                <Plus size={14} /> スキルを追加
              </button>
              {missingSkills.length > 0 && (
                <div className="callout-inline callout-info">
                  <Wand2 size={16} />
                  <div className="stack" style={{ gap: 6 }}>
                    <span>経歴の環境に書いた技術で、スキル欄にないものがあります。押すと追加します。</span>
                    <div className="chips">
                      {missingSkills.map((name) => (
                        <button
                          type="button"
                          key={name}
                          className="chip"
                          style={{ minHeight: 30, fontSize: 12 }}
                          onClick={() => touch(setSkills)([...skills.filter((s) => s.name.trim()), { name, level: 3, years: 1 }])}
                        >
                          <Plus size={12} /> {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Award size={18} /> 資格
                </h2>
              </div>
              {qualifications.length === 0 && <p className="small muted">業務に関係するIT資格を、正式名称で入れてください。なければ空欄で大丈夫です。</p>}
              {qualifications.map((q, i) => (
                <div className="inline" key={i} style={{ flexWrap: "nowrap" }}>
                  <input
                    value={q.name}
                    onChange={(e) => touch(setQualifications)(qualifications.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="例：基本情報技術者試験"
                    aria-label="資格名"
                    maxLength={100}
                  />
                  <input
                    type="month"
                    value={q.acquired}
                    onChange={(e) => touch(setQualifications)(qualifications.map((x, idx) => (idx === i ? { ...x, acquired: e.target.value } : x)))}
                    aria-label="取得年月"
                    style={{ flex: "0 0 150px" }}
                  />
                  <button type="button" className="plan-delete" onClick={() => touch(setQualifications)(qualifications.filter((_, idx) => idx !== i))} aria-label="この資格を削除">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => touch(setQualifications)([...qualifications, { ...emptyQual }])}>
                <Plus size={14} /> 資格を追加
              </button>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Briefcase size={18} /> 職務経歴
                </h2>
                <span className="small muted">プロジェクトごとに。出力は新しい順に並びます</span>
              </div>
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={addExp}>
                <Plus size={14} /> 経歴を追加
              </button>
              {experiences.map((exp, i) => (
                <div className="experience-form" key={i} style={{ marginBottom: 0 }}>
                  <div className="spread">
                    <button type="button" className="exp-toggle" onClick={() => toggleExp(i)} aria-expanded={openExp.has(i)}>
                      <ChevronRight size={16} className="exp-chevron" />
                      <span>
                        <strong className="small">{exp.title || `経歴 ${i + 1}（未入力）`}</strong>
                        <span className="small muted" style={{ display: "block" }}>
                          {[exp.startMonth ? `${exp.startMonth.replace("-", "/")}〜${exp.endMonth ? exp.endMonth.replace("-", "/") : "現在"}（${durationLabel(monthsOf(exp))}）` : "期間未入力", exp.role, exp.teamSize ? `${exp.teamSize}名` : "", exp.phases.length ? `${exp.phases.length}工程` : ""]
                            .filter(Boolean)
                            .join("・")}
                        </span>
                      </span>
                    </button>
                    <span className="inline" style={{ gap: 2 }}>
                      <button type="button" className="plan-delete" disabled={i === 0} onClick={() => moveExp(i, -1)} aria-label={`経歴${i + 1}を上へ`}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" className="plan-delete" disabled={i === experiences.length - 1} onClick={() => moveExp(i, 1)} aria-label={`経歴${i + 1}を下へ`}>
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" className="plan-delete" onClick={() => removeExp(i)} aria-label={`経歴${i + 1}を削除`}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                  {openExp.has(i) && (
                  <>
                  <div className="form-grid">
                    <label>
                      プロジェクト名
                      <input placeholder="例：大手ECサイト リプレイス" value={exp.title} onChange={(e) => updateExp(i, { title: e.target.value })} maxLength={100} />
                    </label>
                    <label>
                      業種 <span className="field-hint">任意</span>
                      <input placeholder="例：金融・小売・EC" value={exp.industry} onChange={(e) => updateExp(i, { industry: e.target.value })} maxLength={40} />
                    </label>
                    <label>
                      開始月
                      <input type="month" value={exp.startMonth} onChange={(e) => updateExp(i, { startMonth: e.target.value })} />
                    </label>
                    <label>
                      終了月 <span className="field-hint">空欄なら「現在」</span>
                      <input type="month" value={exp.endMonth ?? ""} min={exp.startMonth || undefined} onChange={(e) => updateExp(i, { endMonth: e.target.value || null })} />
                    </label>
                    <label>
                      役割
                      <input list="role-options" placeholder="例：SE" value={exp.role} onChange={(e) => updateExp(i, { role: e.target.value })} maxLength={40} />
                    </label>
                    <label>
                      チームの人数
                      <input type="number" min={1} max={10000} placeholder="例：8" value={exp.teamSize ?? ""} onChange={(e) => updateExp(i, { teamSize: e.target.value ? Number(e.target.value) : null })} />
                    </label>
                  </div>
                  <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                    <legend className="small" style={{ fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>
                      担当した工程
                    </legend>
                    <div className="chips">
                      {PHASES.map((p) => {
                        const on = exp.phases.includes(p);
                        return (
                          <button
                            type="button"
                            key={p}
                            className="chip"
                            style={{ minHeight: 32, fontSize: 12, padding: "0 12px" }}
                            aria-pressed={on}
                            onClick={() => updateExp(i, { phases: on ? exp.phases.filter((x) => x !== p) : PHASES.filter((x) => x === p || exp.phases.includes(x)) })}
                          >
                            {on && <Check size={12} />} {p}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label>
                    プロジェクトの概要
                    <textarea rows={2} placeholder="例：月間500万人が利用するECサイトのフロントエンドを、Next.jsへ段階的に移行" value={exp.overview} onChange={(e) => updateExp(i, { overview: e.target.value })} maxLength={1000} />
                  </label>
                  <label>
                    担当したこと・成果 <span className="field-hint">できるだけ数字で（件数・人数・○%改善など）</span>
                    <textarea rows={3} placeholder="例：商品一覧・カート画面の設計と実装をリード。表示速度（LCP）を3.1秒から1.8秒に短縮" value={exp.tasks} onChange={(e) => updateExp(i, { tasks: e.target.value })} maxLength={2000} />
                  </label>
                  <div className="form-grid">
                    {ENV_FIELDS.map((f) => (
                      <label key={f.key}>
                        {f.label}
                        <input value={exp[f.key]} onChange={(e) => updateExp(i, { [f.key]: e.target.value } as Partial<Experience>)} placeholder={ENV_PLACEHOLDER[f.key]} maxLength={300} />
                      </label>
                    ))}
                  </div>
                  </>
                  )}
                </div>
              ))}
              <datalist id="role-options">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </section>

            <section className="panel stack">
              <div className="panel-head">
                <h2>
                  <Sparkles size={18} /> 自己PR
                </h2>
              </div>
              <p className="small muted">「何ができるか」を、経験年数や数字と一緒に1行ずつ。3つ前後がちょうどよい量です。</p>
              {appealPoints.map((point, i) => (
                <div className="inline" key={i} style={{ flexWrap: "nowrap" }}>
                  <input
                    placeholder="例：Java 6年・TypeScript 3年。設計から実装・テストまで一人で担当できる"
                    value={point}
                    onChange={(e) => touch(setAppealPoints)(appealPoints.map((p, idx) => (idx === i ? e.target.value : p)))}
                    aria-label={`アピールポイント${i + 1}`}
                    maxLength={300}
                  />
                  <button type="button" className="plan-delete" onClick={() => touch(setAppealPoints)(appealPoints.filter((_, idx) => idx !== i))} aria-label={`アピールポイント${i + 1}を削除`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} disabled={appealPoints.length >= 10} onClick={() => touch(setAppealPoints)([...appealPoints, ""])}>
                <Plus size={14} /> アピールポイントを追加
              </button>
              <label>
                備考 <span className="field-hint">働き方の希望など</span>
                <textarea value={remarks} onChange={(e) => touch(setRemarks)(e.target.value)} placeholder="例：フルリモートでも、朝会・チャットでの進捗共有をこまめに行います" rows={2} maxLength={2000} />
              </label>
            </section>
          </div>

          <aside className="stack skill-aside">
            <section className="panel stack">
              <div className="panel-head">
                <h2>紹介に出せる状態か</h2>
                <span className="small">
                  <strong className="num">{check.done}</strong> / {check.total}
                </span>
              </div>
              <div className="bar">
                <span style={{ width: `${(check.done / check.total) * 100}%`, background: check.done === check.total ? "var(--success)" : "var(--primary)" }} />
              </div>
              <ul className="plan-list" style={{ marginTop: 0 }}>
                {check.checks.map((c) => (
                  <li key={c.key} className="small" style={{ padding: "6px 0" }}>
                    {c.done ? <Check size={16} style={{ color: "var(--success)", flex: "none" }} /> : <span style={{ width: 16, flex: "none", textAlign: "center" }}>・</span>}
                    <span className={c.done ? "" : "muted"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {message && (
                <div className={message.ok ? "form-success" : "form-error"} role="status">
                  {message.text}
                </div>
              )}
              {dirty && !message && <span className="small" style={{ color: "var(--warning)" }}>保存していない変更があります</span>}
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                <FileText size={16} /> {saving ? "作成中…" : hasSheet ? "保存して作り直す" : "保存して作る"}
              </button>
              {hasSheet && !dirty && (
                <div className="inline">
                  <Link href="/print/skill-sheet" className="btn-secondary btn-sm">
                    <Printer size={14} /> 表示・印刷
                  </Link>
                  {!IS_DEMO && (
                    <button className="btn-secondary btn-sm" onClick={() => downloadFile("/skill-sheet/excel", "スキルシート.xlsx").catch((e) => setMessage({ ok: false, text: e.message }))}>
                      <Download size={14} /> Excel
                    </button>
                  )}
                </div>
              )}
              {hasSheet && dirty && <span className="small muted">印刷・Excelの前に保存してください</span>}
            </section>

            {summary && (
              <section className="panel stack">
                <div className="panel-head">
                  <h2>紹介文</h2>
                  <button className="btn-ghost btn-sm" onClick={copySummary}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "コピーしました" : "コピー"}
                  </button>
                </div>
                <p className="small muted">エージェントや営業担当に送るときの文面（サマリー）です。メール・チャットにそのまま貼れます。</p>
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
