"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface Gap {
  name: string;
  marketDemand: number;
  myLevel: number;
  gap: number;
}

export default function SkillGapPage() {
  const [gaps, setGaps] = useState<Gap[]>([]);

  useEffect(() => {
    apiFetch<{ gaps: Gap[] }>("/skill-gap").then((res) => setGaps(res.gaps));
  }, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Skill Gap"
        title="スキルギャップ可視化"
        description={<>市場での需要と、あなたの保有スキルレベルを比較します。</>}
      />

      <div className="skillgap-list">
        {gaps.map((g) => (
          <div className="skillgap-row" key={g.name}>
            <div className="skillgap-name">{g.name}</div>
            <div className="skillgap-bar-track">
              <div className="skillgap-bar-market" style={{ width: `${g.marketDemand}%` }} />
              <div className="skillgap-bar-mine" style={{ width: `${g.myLevel}%` }} />
            </div>
            <div className="skillgap-values">
              市場需要 {g.marketDemand} / 自分 {g.myLevel}
            </div>
          </div>
        ))}
      </div>
      <div className="legend">
        <span className="legend-item"><span className="legend-swatch market" /> 市場需要</span>
        <span className="legend-item"><span className="legend-swatch mine" /> 自分のレベル</span>
      </div>
    </div>
  );
}
