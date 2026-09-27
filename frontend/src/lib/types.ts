export interface ClubSummary {
  id: string;
  slug: string;
  name: string;
  catchphrase: string;
  description: string;
  schedule: string;
  place: string;
  level: string;
  photo: string;
  color: "yellow" | "pink" | "mint" | "violet";
  status: "open" | "preparing";
  memberCount: number;
  joined: boolean;
  nextActivity: { id: string; title: string; date: string; location: string } | null;
}

export interface EventItem {
  id: string;
  title: string;
  type: "勉強会" | "部活" | "交流会";
  date: string;
  durationMin: number;
  location: string;
  isOnline: boolean;
  speaker: string | null;
  tags: string;
  description: string;
  capacity: number;
  clubId: string | null;
  club: { slug: string; name: string; color: string } | null;
  _count: { applications: number };
  hasJoinUrl: boolean;
  applied?: boolean;
}
