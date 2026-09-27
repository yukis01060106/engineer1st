"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, MessagesSquare, Search, Sparkles, MapPin } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { useAuth } from "../../../context/AuthContext";
import { man } from "../../../lib/format";

interface Project {
  id: string;
  title: string;
  client: string;
  skills: string;
  unitPrice: number;
  workStyle: string;
  description: string;
  createdAt: string;
}

interface ChatMessage {
  from: "user" | "staff";
  text: string;
}

type SortKey = "match" | "price" | "new";
type PlaceFilter = "all" | "remote" | "office";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "match", label: "マッチ度順" },
  { value: "price", label: "単価が高い順" },
  { value: "new", label: "新着順" },
];

const PLACES: { value: PlaceFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "remote", label: "フルリモート" },
  { value: "office", label: "出社あり" },
];

const skillsOf = (p: Project) => p.skills.split(",").map((s) => s.trim()).filter(Boolean);
const interestText = (p: Project) => `「${p.title}」（${p.client}）の案件について話を聞きたいです。`;

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [mySkills, setMySkills] = useState<string[] | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [place, setPlace] = useState<PlaceFilter>("all");
  const [sort, setSort] = useState<SortKey>("match");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // スキルギャップなどから ?q=スキル名 で開かれたら、その条件で絞り込んでおく
    const q = new URLSearchParams(window.location.search).get("q");
    Promise.all([
      apiFetch<{ projects: Project[] }>("/projects"),
      apiFetch<{ recommendations: (Project & { matchScore: number })[] }>("/projects/recommend/for-me"),
      apiFetch<{ skillSheet: { skills: { name: string }[] } | null }>("/skill-sheet"),
      apiFetch<{ messages: ChatMessage[] }>("/chat"),
    ])
      .then(([list, rec, sheet, chat]) => {
        if (q) setKeyword(q);
        setProjects(list.projects);
        setScores(new Map(rec.recommendations.map((r) => [r.id, r.matchScore])));
        setMySkills(sheet.skillSheet ? sheet.skillSheet.skills.map((s) => s.name.toLowerCase()) : []);
        const sent = chat.messages.filter((m) => m.from === "user").map((m) => m.text);
        setRequested(new Set(list.projects.filter((p) => sent.includes(interestText(p))).map((p) => p.id)));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "案件を読み込めませんでした"));
  }, []);

  const hasSheet = !!mySkills && mySkills.length > 0;

  const visible = useMemo(() => {
    if (!projects) return [];
    const kw = keyword.trim().toLowerCase();
    const min = Number(minPrice) * 10_000 || 0;
    const list = projects.filter((p) => {
      if (kw && ![p.title, p.client, p.skills, p.description].some((f) => f.toLowerCase().includes(kw))) return false;
      if (p.unitPrice < min) return false;
      if (place === "remote" && p.workStyle !== "フルリモート") return false;
      if (place === "office" && p.workStyle === "フルリモート") return false;
      return true;
    });
    const by: Record<SortKey, (a: Project, b: Project) => number> = {
      match: (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.unitPrice - a.unitPrice,
      price: (a, b) => b.unitPrice - a.unitPrice,
      new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return [...list].sort(hasSheet ? by[sort] : sort === "match" ? by.price : by[sort]);
  }, [projects, keyword, minPrice, place, sort, scores, hasSheet]);

  async function requestInfo(p: Project) {
    setSendingId(p.id);
    setError(null);
    try {
      await apiFetch("/chat", { method: "POST", body: JSON.stringify({ text: interestText(p) }) });
      setRequested((prev) => new Set(prev).add(p.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "送信できませんでした。時間をおいてお試しください");
    } finally {
      setSendingId(null);
    }
  }

  const isEmployee = user?.workStyle === "ses_employee";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Projects"
        title="案件をさがす"
        description={
          <>
            ソトバがお預かりしている業務委託の案件です。気になる案件は「話を聞きたい」を押すと、担当者から条件をご案内します（応募ではありません）。
          </>
        }
      />

      {isEmployee && (
        <div className="callout-inline callout-info">
          <Sparkles size={16} />
          <div>
            いまは会社員として働いていても、見るだけ・話を聞くだけで大丈夫です。独立した場合の手取りは{" "}
            <Link href="/reward-sim" className="btn-link">
              手取りシミュレーション
            </Link>{" "}
            で比べられます。
          </div>
        </div>
      )}

      {mySkills && !hasSheet && (
        <section className="panel" style={{ background: "var(--yellow-soft)", borderColor: "transparent" }}>
          <div className="spread">
            <div className="stack" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 17 }}>スキルシートをつくると、マッチ度がわかります</h2>
              <p className="small">保有スキルと案件の必須スキルを照らし合わせて、合いそうな順に並べます。担当者からの提案も早くなります。</p>
            </div>
            <Link href="/skill-sheet" className="btn-primary">
              <FileText size={16} /> スキルシートをつくる
            </Link>
          </div>
        </section>
      )}

      <section className="panel stack">
        <div className="toolbar">
          <label className="sr-only" htmlFor="project-keyword">
            キーワード
          </label>
          <input
            id="project-keyword"
            placeholder="キーワード（スキル・案件名・会社名）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <label className="sr-only" htmlFor="project-min">
            単価の下限（万円）
          </label>
          <input
            id="project-min"
            className="input-narrow"
            placeholder="単価の下限（万円）"
            type="number"
            min={0}
            step={5}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="並び順" style={{ flex: "0 1 170px", width: "auto" }}>
            {SORTS.filter((s) => hasSheet || s.value !== "match").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="spread">
          <div className="chips" role="group" aria-label="働き方">
            {PLACES.map((p) => (
              <button key={p.value} type="button" className="chip" aria-pressed={place === p.value} onClick={() => setPlace(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          {projects && (
            <span className="small muted">
              <strong className="num">{visible.length}</strong> 件 / 全{projects.length}件
            </span>
          )}
        </div>
      </section>

      {error && <div className="form-error" role="alert">{error}</div>}

      {!projects && !error && (
        <div className="project-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 260 }} />
          ))}
        </div>
      )}

      {projects && visible.length === 0 && (
        <div className="empty-state">
          <Search size={20} />
          <p>条件に合う案件が見つかりませんでした。条件をゆるめるか、担当者に希望を伝えてください。</p>
          <Link href="/chat" className="btn-secondary btn-sm">
            担当者に希望を伝える
          </Link>
        </div>
      )}

      <div className="project-list">
        {visible.map((p) => {
          const score = scores.get(p.id);
          const done = requested.has(p.id);
          return (
            <article className="project-card" key={p.id}>
              <div className="project-card-header">
                <h3 style={{ fontSize: 16 }}>{p.title}</h3>
                {hasSheet && score !== undefined && <span className="match-score">マッチ {score}%</span>}
              </div>
              <div className="project-client">{p.client}</div>
              <div className="project-price">
                {man(p.unitPrice).replace("万円", "")}
                <span className="small" style={{ marginLeft: 2 }}>
                  万円／月
                </span>
              </div>
              <div className="project-skills">
                {skillsOf(p).map((sk) => {
                  const mine = mySkills?.includes(sk.toLowerCase());
                  return (
                    <span className={"badge" + (mine ? " badge-mint" : "")} key={sk} title={mine ? "スキルシートに登録済み" : undefined}>
                      {mine && <Check size={12} />} {sk}
                    </span>
                  );
                })}
              </div>
              <div className="project-workstyle inline" style={{ gap: 4 }}>
                <MapPin size={13} /> {p.workStyle}
              </div>
              <p className="project-desc">{p.description}</p>
              <div style={{ marginTop: "auto", paddingTop: 6 }}>
                {done ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="form-success inline" style={{ gap: 6 }}>
                      <Check size={14} /> 担当者に伝えました
                    </span>
                    <Link href="/chat" className="btn-link small">
                      チャットを見る <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <button className="btn-primary btn-sm" onClick={() => requestInfo(p)} disabled={sendingId === p.id}>
                    <MessagesSquare size={15} /> {sendingId === p.id ? "送信中…" : "話を聞きたい"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {projects && (
        <p className="disclaimer">
          マッチ度は、スキルシートの保有スキルと案件の必須スキルの一致率です。単価は税抜・月額（精算幅あり）の目安で、面談の結果によって変わることがあります。
        </p>
      )}
    </div>
  );
}
