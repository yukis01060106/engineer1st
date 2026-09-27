"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "../../../api/client";
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

async function downloadExcel() {
  const token = getToken();
  const res = await fetch("/api/skill-sheet/excel", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "スキルシート.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

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

  useEffect(() => {
    apiFetch<{ skillSheet: SkillSheetData | null }>("/skill-sheet").then((res) => {
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Skill Sheet"
        title="スキルシート・サマリーシート"
        description={<>すでに分かっている情報（単価・稼働開始時期・経験年数など）は自動で入力しています。ここでは足りない項目だけ入力してください。保存すると、Excelのスキルシートと文章のサマリーシートが自動生成されます。</>}
      />

      {summary && (
        <div className="summary-box">
          <div className="card-label">自動生成サマリーシート</div>
          <pre className="summary-text">{summary}</pre>
        </div>
      )}

      {hasSheet && (
        <button className="btn-secondary" onClick={downloadExcel}>
          📄 スキルシート（Excel）をダウンロード
        </button>
      )}

      <section className="section">
        <h2>基本情報</h2>
        <div className="sim-form">
          <label>
            年齢
            <input type="number" min={16} value={age} onChange={(e) => setAge(e.target.value)} placeholder="32" />
          </label>
          <label>
            最寄駅・希望勤務形態
            <input
              value={nearestStation}
              onChange={(e) => setNearestStation(e.target.value)}
              placeholder="例: 東京都 ※フルリモート希望（月1回は出社可）"
            />
          </label>
          <label>
            稼働開始
            <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="即日" />
          </label>
          <label>
            希望単価（円）
            <input
              type="number"
              value={desiredRate}
              onChange={(e) => setDesiredRate(e.target.value)}
              placeholder="700000"
            />
          </label>
          <label>
            IT経験年数
            <input
              type="number"
              min={0}
              value={totalExperienceYears}
              onChange={(e) => setTotalExperienceYears(e.target.value)}
              placeholder="保有スキルから自動算出"
            />
          </label>
        </div>
      </section>

      <section className="section">
        <h2>対応可能工程</h2>
        <div className="form-row">
          {WORK_PROCESS_OPTIONS.map((process) => (
            <label className="checkbox-label" key={process}>
              <input
                type="checkbox"
                checked={workProcesses.includes(process)}
                onChange={() => toggleWorkProcess(process)}
              />
              {process}
            </label>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>保有スキル</h2>
        {skills.map((s, i) => (
          <div className="form-row" key={i}>
            <input
              placeholder="スキル名（例: TypeScript）"
              value={s.name}
              onChange={(e) => {
                const next = [...skills];
                next[i] = { ...next[i], name: e.target.value };
                setSkills(next);
              }}
            />
            <select
              value={s.level}
              onChange={(e) => {
                const next = [...skills];
                next[i] = { ...next[i], level: Number(e.target.value) };
                setSkills(next);
              }}
            >
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  レベル{l}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              placeholder="経験年数"
              value={s.years}
              onChange={(e) => {
                const next = [...skills];
                next[i] = { ...next[i], years: Number(e.target.value) };
                setSkills(next);
              }}
            />
            <button className="btn-danger-outline" onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}>
              削除
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => setSkills([...skills, { ...emptySkill }])}>
          + スキルを追加
        </button>
      </section>

      <section className="section">
        <h2>プロジェクト経歴</h2>
        {experiences.map((exp, i) => (
          <div className="experience-form" key={i}>
            <input
              placeholder="案件タイトル"
              value={exp.title}
              onChange={(e) => {
                const next = [...experiences];
                next[i] = { ...next[i], title: e.target.value };
                setExperiences(next);
              }}
            />
            <div className="form-row">
              <input
                placeholder="期間（例: 2025-04〜稼働中）"
                value={exp.period}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i] = { ...next[i], period: e.target.value };
                  setExperiences(next);
                }}
              />
              <input
                placeholder="役割（例: フロントエンドエンジニア）"
                value={exp.role}
                onChange={(e) => {
                  const next = [...experiences];
                  next[i] = { ...next[i], role: e.target.value };
                  setExperiences(next);
                }}
              />
            </div>
            <input
              placeholder="使用技術（例: React, TypeScript）"
              value={exp.tech}
              onChange={(e) => {
                const next = [...experiences];
                next[i] = { ...next[i], tech: e.target.value };
                setExperiences(next);
              }}
            />
            <textarea
              placeholder="担当業務の説明"
              value={exp.description}
              onChange={(e) => {
                const next = [...experiences];
                next[i] = { ...next[i], description: e.target.value };
                setExperiences(next);
              }}
            />
            <button
              className="btn-danger-outline"
              onClick={() => setExperiences(experiences.filter((_, idx) => idx !== i))}
            >
              この経歴を削除
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => setExperiences([...experiences, { ...emptyExperience }])}>
          + 経歴を追加
        </button>
      </section>

      <section className="section">
        <h2>アピールポイント</h2>
        {appealPoints.map((point, i) => (
          <div className="form-row" key={i}>
            <input
              placeholder="例: TypeScript / React を軸としたモダン開発スキル"
              value={point}
              onChange={(e) => {
                const next = [...appealPoints];
                next[i] = e.target.value;
                setAppealPoints(next);
              }}
            />
            <button
              className="btn-danger-outline"
              onClick={() => setAppealPoints(appealPoints.filter((_, idx) => idx !== i))}
            >
              削除
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => setAppealPoints([...appealPoints, ""])}>
          + アピールポイントを追加
        </button>
      </section>

      <section className="section">
        <h2>備考／PR</h2>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="その他アピールしたいことがあれば自由に記入してください"
        />
      </section>

      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "生成中..." : "サマリーシートを自動生成して保存"}
      </button>
    </div>
  );
}
