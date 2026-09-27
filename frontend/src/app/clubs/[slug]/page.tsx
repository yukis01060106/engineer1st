import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, MapPin, Video } from "lucide-react";
import { SiteLayout } from "../../../components/SiteLayout";
import { Photo } from "../../../components/Photo";
import { Reveal } from "../../../components/Reveal";
import { EventDate } from "../../../components/EventDate";
import { ClubJoinButton } from "../../../components/ClubJoinButton";
import { InviteButton } from "../../../components/InviteButton";
import { serverFetch, serverFetchOr } from "../../../lib/serverApi";
import { dateParts } from "../../../lib/format";
import type { ClubSummary, EventItem } from "../../../lib/types";

export const revalidate = 300;

type ClubDetail = Omit<ClubSummary, "nextActivity"> & { events: Omit<EventItem, "club" | "_count" | "hasJoinUrl">[] };

async function getClub(slug: string): Promise<ClubDetail | null> {
  try {
    const { club } = await serverFetch<{ club: ClubDetail }>(`/clubs/${encodeURIComponent(slug)}`, 300);
    return club;
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  const { clubs } = await serverFetchOr<{ clubs: ClubSummary[] }>("/clubs", { clubs: [] });
  return clubs.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);
  if (!club) return { title: "部活が見つかりません" };
  return {
    title: club.name,
    description: `${club.catchphrase} ${club.description}`.slice(0, 120),
    alternates: { canonical: `/clubs/${slug}` },
    openGraph: { images: [`/photos/${club.photo}`] },
  };
}

export default async function ClubDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClub(slug);
  if (!club) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: `ソトバ ${club.name}`,
    description: club.description,
    location: club.place,
  };

  return (
    <SiteLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container">
        <nav className="breadcrumb" aria-label="パンくず">
          <Link href="/">トップ</Link>/<Link href="/clubs">部活</Link>/<span>{club.name}</span>
        </nav>
        <section className="detail-hero">
          <Reveal className="detail-body">
            <span className="eyebrow">Club</span>
            <h1>{club.name}</h1>
            <p className="detail-catch">{club.catchphrase}</p>
            <p className="muted">{club.description}</p>
            <dl className="info-table">
              <dt>活動日</dt>
              <dd>{club.schedule}</dd>
              <dt>場所</dt>
              <dd>{club.place}</dd>
              <dt>レベル</dt>
              <dd>{club.level}</dd>
              <dt>部員</dt>
              <dd>{club.memberCount}人</dd>
              <dt>費用</dt>
              <dd>参加無料（施設利用料のみ実費を割り勘）</dd>
            </dl>
            <ClubJoinButton slug={club.slug} name={club.name} />
            <InviteButton
              path={`/clubs/${club.slug}/`}
              title={`ソトバ ${club.name}`}
              text={`${club.name}、いっしょにどう？ ${club.schedule}・${club.place}。参加は無料です。`}
              className="btn-ghost btn-sm"
            />
          </Reveal>
          <Reveal delay={120}>
            <Photo src={`/photos/${club.photo}`} alt={club.name} blob={club.color} priority />
          </Reveal>
        </section>

        <section style={{ padding: "24px 0 96px" }}>
          <div className="section-title">
            <span className="eyebrow">Next</span>
            <h2 style={{ fontSize: 24 }}>次の活動</h2>
          </div>
          <div className="event-list">
            {club.events.length === 0 && <div className="empty-state">次の活動は準備中です</div>}
            {club.events.map((e) => (
              <Link href={`/events/${e.id}`} className="event-row" key={e.id}>
                <EventDate date={e.date} />
                <div className="event-body">
                  <h3>{e.title}</h3>
                  <div className="event-meta">
                    <span>
                      <Clock size={14} /> {dateParts(e.date).time}〜（{e.durationMin}分）
                    </span>
                    <span>
                      {e.isOnline ? <Video size={14} /> : <MapPin size={14} />} {e.location}
                    </span>
                  </div>
                </div>
                <span className="btn-secondary btn-sm">
                  申し込む <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
