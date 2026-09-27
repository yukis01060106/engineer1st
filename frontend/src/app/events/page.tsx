import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Video, Users } from "lucide-react";
import { SiteLayout } from "../../components/SiteLayout";
import { Reveal } from "../../components/Reveal";
import { EventDate } from "../../components/EventDate";
import { serverFetchOr } from "../../lib/serverApi";
import { dateParts } from "../../lib/format";
import type { EventItem } from "../../lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "勉強会・イベント",
  description:
    "フリーランス・SESエンジニア向けのオンライン技術勉強会、部活の活動、交流会の予定。申込フォームを送ると参加URLがすぐに発行されます。",
  alternates: { canonical: "/events" },
};

const SECTIONS: { type: EventItem["type"]; eyebrow: string; title: string; desc: string }[] = [
  { type: "勉強会", eyebrow: "Study", title: "オンライン勉強会", desc: "申込フォームを送ると、その場で参加URLが発行されます。" },
  { type: "部活", eyebrow: "Clubs", title: "部活の活動", desc: "申し込むと、その部にも自動で入部します。" },
  { type: "交流会", eyebrow: "Meetup", title: "交流会", desc: "独立している人も、考え中の人も。" },
];

export default async function EventsPage() {
  const { events } = await serverFetchOr<{ events: EventItem[] }>("/events", { events: [] }, 60);

  return (
    <SiteLayout>
      <div className="container" style={{ padding: "48px var(--gutter) 96px" }}>
        <Reveal className="section-title">
          <span className="eyebrow">Events</span>
          <h2>勉強会・イベント</h2>
          <p>参加はすべて無料です。申し込みには無料の会員登録が必要です。</p>
        </Reveal>

        <div className="tabs" style={{ marginBottom: 32 }}>
          {SECTIONS.map((s) => (
            <a key={s.type} href={`#${s.eyebrow.toLowerCase()}`} className="chip">
              {s.title}
            </a>
          ))}
        </div>

        <div className="stack-lg">
          {SECTIONS.map((s) => {
            const list = events.filter((e) => e.type === s.type);
            return (
              <section key={s.type} id={s.eyebrow.toLowerCase()} style={{ scrollMarginTop: 90 }}>
                <div className="spread" style={{ marginBottom: 14 }}>
                  <div>
                    <span className="eyebrow">{s.eyebrow}</span>
                    <h2 style={{ marginTop: 6 }}>{s.title}</h2>
                  </div>
                  <span className="small muted">{s.desc}</span>
                </div>
                <div className="event-list">
                  {list.length === 0 && <div className="empty-state">予定を準備中です</div>}
                  {list.map((e) => (
                    <Link href={`/events/${e.id}`} className="event-row" key={e.id}>
                      <EventDate date={e.date} />
                      <div className="event-body">
                        <div className="inline">
                          {e.club && <span className={`badge badge-${e.club.color}`}>{e.club.name}</span>}
                          {(e.tags ?? "")
                            .split(",")
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((t) => (
                              <span className="badge" key={t}>
                                {t}
                              </span>
                            ))}
                        </div>
                        <h3>{e.title}</h3>
                        <div className="event-meta">
                          <span>
                            <Clock size={14} /> {dateParts(e.date).time}〜（{e.durationMin}分）
                          </span>
                          <span>
                            {e.isOnline ? <Video size={14} /> : <MapPin size={14} />} {e.location}
                          </span>
                          <span>
                            <Users size={14} /> {e._count.applications}/{e.capacity}人
                          </span>
                        </div>
                      </div>
                      <span className="btn-secondary btn-sm">
                        詳細・申込 <ArrowRight size={14} />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </SiteLayout>
  );
}
