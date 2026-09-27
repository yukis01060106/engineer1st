import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Video, Users, Mic } from "lucide-react";
import { SiteLayout } from "../../../components/SiteLayout";
import { Photo } from "../../../components/Photo";
import { Reveal } from "../../../components/Reveal";
import { EventApply } from "../../../components/EventApply";
import { InviteButton } from "../../../components/InviteButton";
import { serverFetch, serverFetchOr } from "../../../lib/serverApi";
import { fmtDateTime } from "../../../lib/format";
import { SITE_URL } from "../../../lib/site";
import type { EventItem } from "../../../lib/types";

export const revalidate = 60;

export async function generateStaticParams() {
  const { events } = await serverFetchOr<{ events: { id: string }[] }>("/events", { events: [] });
  return events.map((e) => ({ id: e.id }));
}

async function getEvent(id: string): Promise<EventItem | null> {
  try {
    const { event } = await serverFetch<{ event: EventItem }>(`/events/${encodeURIComponent(id)}`, 60);
    return event;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "イベントが見つかりません" };
  return {
    title: event.title,
    description: event.description.slice(0, 120),
    alternates: { canonical: `/events/${id}` },
  };
}

const PHOTO_BY_TYPE: Record<string, string> = { 勉強会: "study.webp", 交流会: "community.webp" };
const CLUB_PHOTO: Record<string, string> = {
  pickleball: "club-pickleball.webp",
  training: "club-training.webp",
  running: "club-running.webp",
  futsal: "club-futsal.webp",
  bouldering: "club-bouldering.webp",
  stretch: "club-stretch.webp",
};

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const photo = (event.club && CLUB_PHOTO[event.club.slug]) || PHOTO_BY_TYPE[event.type] || "community.webp";
  const end = new Date(new Date(event.date).getTime() + event.durationMin * 60_000);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.date,
    endDate: end.toISOString(),
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location: event.isOnline ? { "@type": "VirtualLocation", url: `${SITE_URL}/events/${event.id}` } : { "@type": "Place", name: event.location },
    description: event.description,
    isAccessibleForFree: true,
    organizer: { "@type": "Organization", name: "ソトバ" },
  };

  return (
    <SiteLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container">
        <nav className="breadcrumb" aria-label="パンくず">
          <Link href="/">トップ</Link>/<Link href="/events">勉強会・イベント</Link>/<span>{event.type}</span>
        </nav>
        <section className="detail-hero" style={{ alignItems: "start" }}>
          <Reveal className="detail-body">
            <div className="inline">
              <span className="badge badge-violet">{event.type}</span>
              {event.club && <span className={`badge badge-${event.club.color}`}>{event.club.name}</span>}
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.4vw, 36px)" }}>{event.title}</h1>
            <p className="muted">{event.description}</p>
            <dl className="info-table">
              <dt>
                <Clock size={14} /> 日時
              </dt>
              <dd>
                {fmtDateTime(event.date)}〜（{event.durationMin}分）
              </dd>
              <dt>{event.isOnline ? <Video size={14} /> : <MapPin size={14} />} 場所</dt>
              <dd>{event.location}</dd>
              {event.speaker && (
                <>
                  <dt>
                    <Mic size={14} /> 講師
                  </dt>
                  <dd>{event.speaker}</dd>
                </>
              )}
              <dt>
                <Users size={14} /> 定員
              </dt>
              <dd>
                {event._count.applications} / {event.capacity}人
              </dd>
              <dt>参加費</dt>
              <dd>無料</dd>
            </dl>
            <EventApply
              event={{
                id: event.id,
                title: event.title,
                type: event.type,
                date: event.date,
                durationMin: event.durationMin,
                location: event.location,
                isOnline: event.isOnline,
                full: event._count.applications >= event.capacity,
                clubName: event.club?.name ?? null,
              }}
            />
            <InviteButton
              path={`/events/${event.id}/`}
              title={event.title}
              text={`「${event.title}」いっしょに参加しない？ ${fmtDateTime(event.date)}〜・参加無料`}
              className="btn-ghost btn-sm"
              style={{ justifySelf: "start" }}
            />
          </Reveal>
          <Reveal delay={120} style={{ position: "sticky", top: 96 }}>
            <Photo src={`/photos/${photo}`} alt="" blob={event.club?.color as "yellow" | "pink" | "mint" | "violet" | undefined ?? "violet"} />
          </Reveal>
        </section>
      </div>
    </SiteLayout>
  );
}
