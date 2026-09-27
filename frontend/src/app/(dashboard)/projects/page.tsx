"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface Project {
  id: string;
  title: string;
  client: string;
  skills: string;
  unitPrice: number;
  workStyle: string;
  description: string;
  matchScore?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [recommended, setRecommended] = useState(false);
  const [loading, setLoading] = useState(true);

  function loadProjects() {
    setLoading(true);
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (minPrice) params.set("minPrice", minPrice);
    const query = params.toString() ? `?${params.toString()}` : "";
    apiFetch<{ projects: Project[] }>(`/projects${query}`)
      .then((res) => setProjects(res.projects))
      .finally(() => setLoading(false));
  }

  function loadRecommended() {
    setLoading(true);
    apiFetch<{ recommendations: Project[] }>("/projects/recommend/for-me")
      .then((res) => setProjects(res.recommendations))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/projects")
      .then((res) => setProjects(res.projects))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader eyebrow="Projects" title="案件一覧" />
      <div className="toolbar panel" style={{ display: "flex" }}>
        <input
          placeholder="キーワード（スキル・案件名など）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setRecommended(false);
              loadProjects();
            }
          }}
        />
        <input
          className="input-narrow"
          placeholder="単価下限（円）"
          type="number"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <button
          className="btn-secondary"
          onClick={() => {
            setRecommended(false);
            loadProjects();
          }}
        >
          検索
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            setRecommended(true);
            loadRecommended();
          }}
        >
          AIにおすすめ案件を聞く
        </button>
      </div>

      {loading && <div className="loading-screen">読み込み中...</div>}

      <div className="project-list">
        {projects.map((p) => (
          <div className="project-card" key={p.id}>
            <div className="project-card-header">
              <h3>{p.title}</h3>
            </div>
            <div className="project-client">{p.client}</div>
            <div className="project-price">{(p.unitPrice / 10000).toLocaleString()}<span className="small" style={{ marginLeft: 2 }}>万円／月</span></div>
            <div className="project-skills">
              {p.skills.split(",").map((sk) => (
                <span className="badge" key={sk}>
                  {sk.trim()}
                </span>
              ))}
            </div>
            <div className="project-workstyle">{p.workStyle}</div>
            <p className="project-desc">{p.description}</p>
            {recommended && p.matchScore !== undefined && (
              <div className="match-score">マッチ度 {p.matchScore}%</div>
            )}
          </div>
        ))}
        {!loading && projects.length === 0 && <div className="empty-state">案件が見つかりませんでした</div>}
      </div>
    </div>
  );
}
