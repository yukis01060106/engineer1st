import Link from "next/link";
import Image from "next/image";
import { Check, Clock, MapPin, Users } from "lucide-react";
import { asset } from "../lib/demo";
import type { ClubSummary } from "../lib/types";

// 部活カード（LP・部活一覧・アプリ内で共通）。準備中の部は写真を淡くして「準備中」と表示する
export function ClubCard({ club, compact = false }: { club: ClubSummary; compact?: boolean }) {
  const preparing = club.status !== "open";
  return (
    <Link href={`/clubs/${club.slug}`} className={`club-card${preparing ? " is-preparing" : ""}`}>
      <div className="club-card-photo" style={compact ? { borderRadius: 16 } : undefined}>
        <Image src={asset(`/photos/${club.photo}`)} alt={club.name} fill sizes={compact ? "240px" : "(max-width: 640px) 100vw, 300px"} />
        {preparing ? (
          <span className="badge club-card-tag club-card-preparing">準備中</span>
        ) : club.joined ? (
          <span className="badge badge-success club-card-tag">
            <Check size={12} /> 入部中
          </span>
        ) : (
          <span className={`badge badge-${club.color} club-card-tag`}>{club.level}</span>
        )}
      </div>
      <h3 style={compact ? { fontSize: 15 } : undefined}>{club.name}</h3>
      {!compact && <p>{club.catchphrase}</p>}
      <div className="club-meta">
        {preparing ? (
          <span>近日スタート予定</span>
        ) : (
          <>
            <span>
              <Clock size={14} /> {club.schedule}
            </span>
            {!compact && (
              <>
                <span>
                  <MapPin size={14} /> {club.place}
                </span>
                <span>
                  <Users size={14} /> 部員 {club.memberCount}人
                </span>
              </>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
