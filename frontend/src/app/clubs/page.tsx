import type { Metadata } from "next";
import { SiteLayout } from "../../components/SiteLayout";
import { Reveal } from "../../components/Reveal";
import { ClubCard } from "../../components/ClubCard";
import { serverFetchOr } from "../../lib/serverApi";
import type { ClubSummary } from "../../lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "部活",
  description:
    "フリーランス・SESエンジニアのための部活。いまはピックルボール部と筋トレ部が活動中。参加は無料の会員登録だけ。",
  alternates: { canonical: "/clubs" },
};

export default async function ClubsPage() {
  const { clubs } = await serverFetchOr<{ clubs: ClubSummary[] }>("/clubs", { clubs: [] }, 300);
  const open = clubs.filter((c) => c.status === "open");
  const preparing = clubs.filter((c) => c.status !== "open");

  return (
    <SiteLayout>
      <section className="section" style={{ paddingTop: 48 }}>
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">Clubs</span>
            <h2>
              座りっぱなしのエンジニアに、
              <br />
              <span className="marker">部活</span>という居場所を。
            </h2>
            <p>
              現場も会社もバラバラなエンジニアが、体を動かしながら自然と知り合える場所です。参加に必要なのは、無料の会員登録だけ。
            </p>
          </Reveal>
          <h2 className="club-group-label">
            <span className="badge badge-yellow">活動中</span> いま参加できる部活
          </h2>
          <div className="club-grid">
            {open.map((c, i) => (
              <Reveal key={c.slug} delay={i * 80}>
                <ClubCard club={c} />
              </Reveal>
            ))}
          </div>
          {preparing.length > 0 && (
            <>
              <h2 className="club-group-label" style={{ marginTop: 56 }}>
                <span className="badge club-card-preparing">準備中</span> これから始まる部活
              </h2>
              <div className="club-grid">
                {preparing.map((c) => (
                  <ClubCard club={c} key={c.slug} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
