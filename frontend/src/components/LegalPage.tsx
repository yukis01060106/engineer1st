import { ReactNode } from "react";
import { SiteLayout } from "./SiteLayout";

// 利用規約・プライバシーポリシーの共通レイアウト
export function LegalPage({
  eyebrow,
  title,
  lead,
  updatedAt,
  sections,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  updatedAt: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <SiteLayout>
      <section className="section" style={{ paddingTop: 48 }}>
        <div className="container legal">
          <div className="section-title">
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{lead}</p>
          </div>
          {sections.map((s) => (
            <section key={s.heading}>
              <h3>{s.heading}</h3>
              {s.body}
            </section>
          ))}
          <p className="small muted">制定日：{updatedAt}</p>
        </div>
      </section>
    </SiteLayout>
  );
}
