"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import type { SkillSheetDocument } from "@shared/skillSheet";
import { apiFetch, ApiError, downloadFile } from "../../../api/client";
import { PrintShell } from "../../../components/PrintShell";
import { IS_DEMO } from "../../../lib/demo";

// スキルシートの印刷用ページ（Excelと同じ構成。ブラウザの印刷でPDFに保存できる）
export default function SkillSheetPrintPage() {
  const [doc, setDoc] = useState<SkillSheetDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiFetch<{ document: SkillSheetDocument | null }>("/skill-sheet/document")
      .then((r) => {
        if (!r.document) {
          setMissing(true);
          return;
        }
        setDoc(r.document);
        document.title = `スキルシート ${r.document.displayName}`;
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "スキルシートを読み込めませんでした"));
  }, []);

  return (
    <PrintShell
      back="/skill-sheet"
      backLabel="スキルシートに戻る"
      actions={
        !IS_DEMO && doc ? (
          <button className="btn-secondary btn-sm" onClick={() => downloadFile("/skill-sheet/excel", `スキルシート_${doc.displayName}.xlsx`)}>
            <Download size={14} /> Excel
          </button>
        ) : undefined
      }
    >
      {error && <div className="form-error" style={{ maxWidth: 1120, margin: "0 auto" }}>{error}</div>}
      {missing && (
        <div className="empty-state" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
          <p>まだスキルシートがありません。経歴とスキルを入れると、ここで印刷・PDF保存できるようになります。</p>
          <Link href="/skill-sheet" className="btn-primary btn-sm">
            スキルシートをつくる
          </Link>
        </div>
      )}
      {!doc && !error && !missing && <div className="skeleton" style={{ height: 700, maxWidth: 1120, width: "100%", margin: "0 auto" }} />}
      {doc && (
        <article className="ss-sheet">
          <header className="ss-head">
            <h1>スキルシート</h1>
            <span>作成日：{doc.createdAt}</span>
          </header>

          <h2 className="ss-section">基本情報</h2>
          <dl className="ss-basics">
            {doc.basics.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <h2 className="ss-section">スキル要約（経験年数・★は特に得意）</h2>
          <table className="ss-table ss-kv">
            <tbody>
              {doc.skillGroups.map((g) => (
                <tr key={g.category}>
                  <th>{g.category}</th>
                  <td>
                    {g.skills.map((s) => (
                      <span key={s.name} className="ss-skill">
                        {s.strong && "★"}
                        {s.name}（{s.years}年）
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              {doc.qualifications.length > 0 && (
                <tr>
                  <th>資格</th>
                  <td>{doc.qualifications.join("／")}</td>
                </tr>
              )}
            </tbody>
          </table>

          {doc.pr.length > 0 && (
            <>
              <h2 className="ss-section">自己PR</h2>
              <ul className="ss-pr">
                {doc.pr.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}

          <h2 className="ss-section">職務経歴</h2>
          <div className="ss-scroll">
            <table className="ss-table ss-history">
              <thead>
                <tr>
                  <th>No</th>
                  <th>期間</th>
                  <th>業務内容</th>
                  <th>役割・規模</th>
                  <th>環境</th>
                  {doc.phaseHeaders.map((h) => (
                    <th key={h} className="ss-phase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.experiences.map((e) => (
                  <tr key={e.no}>
                    <td className="c">{e.no}</td>
                    <td>
                      {e.period}
                      <small>（{e.duration}）</small>
                    </td>
                    <td>
                      <strong>{e.title}</strong>
                      {e.industry && <small>業種：{e.industry}</small>}
                      {e.overview && <p>{e.overview}</p>}
                      {e.tasks && <p>{e.tasks}</p>}
                    </td>
                    <td>
                      {e.role}
                      {e.teamSize && <small>{e.teamSize}</small>}
                    </td>
                    <td>
                      {e.env.map((x) => (
                        <div key={x.label}>
                          <small className="ss-envlabel">{x.label}</small>
                          {x.value}
                        </div>
                      ))}
                    </td>
                    {e.phases.map((on, i) => (
                      <td key={i} className="c ss-phase">
                        {on ? "●" : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </PrintShell>
  );
}
