import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Clock, MapPin, Users } from "lucide-react";
import { SiteLayout } from "../../components/SiteLayout";
import { Reveal } from "../../components/Reveal";
import { serverFetchOr } from "../../lib/serverApi";
import type { ClubSummary } from "../../lib/types";
import { asset } from "../../lib/demo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "部活",
  description:
    "フリーランス・SESエンジニアのための部活。ランニング・フットサル・ボルダリング・朝ストレッチ。参加は無料の会員登録だけ。",
  alternates: { canonical: "/clubs" },
};

export default async function ClubsPage() {
  const { clubs } = await serverFetchOr<{ clubs: ClubSummary[] }>("/clubs", { clubs: [] }, 300);

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
          <div className="club-grid">
            {clubs.map((c, i) => (
              <Reveal key={c.slug} delay={i * 80}>
                <Link href={`/clubs/${c.slug}`} className="club-card">
                  <div className="club-card-photo">
                    <Image src={asset(`/photos/${c.photo}`)} alt={c.name} fill sizes="(max-width: 640px) 100vw, 300px" />
                    <span className={`badge badge-${c.color} club-card-tag`}>{c.level}</span>
                  </div>
                  <h3>{c.name}</h3>
                  <p>{c.catchphrase}</p>
                  <div className="club-meta">
                    <span>
                      <Clock size={14} /> {c.schedule}
                    </span>
                    <span>
                      <MapPin size={14} /> {c.place}
                    </span>
                    <span>
                      <Users size={14} /> 部員 {c.memberCount}人
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
