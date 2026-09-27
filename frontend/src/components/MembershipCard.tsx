const RANK_CLASS: Record<string, string> = {
  ブロンズ: "rank-bronze",
  シルバー: "rank-silver",
  ゴールド: "rank-gold",
  プラチナ: "rank-platinum",
};

interface MembershipCardProps {
  name: string;
  rank: string;
  memberNumber: string;
  joinedAt: string;
}

export function MembershipCard({ name, rank, memberNumber, joinedAt }: MembershipCardProps) {
  const rankClass = RANK_CLASS[rank] ?? "rank-bronze";
  const joinedLabel = new Date(joinedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit" });

  return (
    <div className={"membership-card " + rankClass}>
      <div className="membership-card-top">
        <span className="membership-card-brand">SOTOBA MEMBER</span>
        <span className="membership-card-rank">{rank}</span>
      </div>
      <div className="membership-card-name">{name}</div>
      <div className="membership-card-bottom">
        <span className="membership-card-number">{memberNumber}</span>
        <span className="membership-card-since">MEMBER SINCE {joinedLabel}</span>
      </div>
    </div>
  );
}
