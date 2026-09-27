"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, ExternalLink, MapPin, Users, Video } from "lucide-react";
import { apiFetch } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { EventDate } from "../../../components/EventDate";
import { ClubCard } from "../../../components/ClubCard";
import { dateParts } from "../../../lib/format";
import type { ClubSummary, EventItem } from "../../../lib/types";

interface MyApplication {
  id: string;
  event: EventItem & { joinUrl: string | null; club: { name: string; slug: string } | null };
}

const TABS = ["すべて", "勉強会", "部活", "交流会"] as const;

export default function CommunityPage() {
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [mine, setMine] = useState<MyApplication[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("すべて");

  useEffect(() => {
    apiFetch<{ clubs: ClubSummary[] }>("/clubs").then((r) => setClubs(r.clubs));
    apiFetch<{ events: EventItem[] }>("/events").then((r) => setEvents(r.events));
    apiFetch<{ applications: MyApplication[] }>("/events/my-applications").then((r) =>
      setMine(r.applications.filter((a) => new Date(a.event.date).getTime() > Date.now() - 3 * 3600_000))
    );
  }, []);

  const joined = clubs.filter((c) => c.joined);
  const others = clubs.filter((c) => !c.joined).sort((a, b) => Number(a.status !== "open") - Number(b.status !== "open"));
  const filtered = events.filter((e) => tab === "すべて" || e.type === tab);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Community"
        title="部活・勉強会"
        description="申し込んだ予定の参加URL・集合場所はここにまとまります。部活の活動に申し込むと、その部にも入部します。"
      />

      <section className="panel">
        <div className="panel-head">
          <h2>申し込んでいる予定</h2>
        </div>
        {mine.length === 0 ? (
          <div className="empty-state">まだありません。下の一覧から申し込めます。</div>
        ) : (
          <div className="event-list">
            {mine.map((a) => (
              <div className="event-row" key={a.id}>
                <EventDate date={a.event.date} />
                <div className="event-body">
                  <div className="inline">
                    <span className="badge badge-violet">{a.event.type}</span>
                    {a.event.club && <span className="badge">{a.event.club.name}</span>}
                  </div>
                  <Link href={`/events/${a.event.id}`}>
                    <h3>{a.event.title}</h3>
                  </Link>
                  <div className="event-meta">
                    <span>
                      <Clock size={14} /> {dateParts(a.event.date).time}〜
                    </span>
                    <span>
                      {a.event.isOnline ? <Video size={14} /> : <MapPin size={14} />} {a.event.location}
                    </span>
                  </div>
                </div>
                {a.event.joinUrl ? (
                  <a className="btn-accent btn-sm" href={a.event.joinUrl} target="_blank" rel="noopener noreferrer">
                    参加URL <ExternalLink size={14} />
                  </a>
                ) : (
                  <Link className="btn-secondary btn-sm" href={`/events/${a.event.id}`}>
                    詳細
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            <Users size={18} /> 部活
          </h2>
          <Link href="/clubs" className="btn-link small">
            部活のページへ <ArrowRight size={14} />
          </Link>
        </div>
        <div className="club-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {[...joined, ...others].map((c) => (
            <ClubCard club={c} compact key={c.slug} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>これからの予定</h2>
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t} className="chip" style={{ minHeight: 32 }} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="event-list">
          {filtered.length === 0 && <div className="empty-state">予定はありません</div>}
          {filtered.map((e) => (
            <Link href={`/events/${e.id}`} className="event-row" key={e.id}>
              <EventDate date={e.date} />
              <div className="event-body">
                <div className="inline">
                  <span className="badge badge-violet">{e.type}</span>
                  {e.club && <span className={`badge badge-${e.club.color}`}>{e.club.name}</span>}
                  {e.applied && (
                    <span className="badge badge-success">
                      <Check size={12} /> 申込済み
                    </span>
                  )}
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
                    <Users size={14} /> {e._count.applications}/{e.capacity}
                  </span>
                </div>
              </div>
              <span className="btn-secondary btn-sm">{e.applied ? "詳細" : "申し込む"}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
