import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { serverFetchOr } from "../lib/serverApi";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ clubs }, { events }] = await Promise.all([
    serverFetchOr<{ clubs: { slug: string }[] }>("/clubs", { clubs: [] }, 3600),
    serverFetchOr<{ events: { id: string }[] }>("/events", { events: [] }, 3600),
  ]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/clubs`, changeFrequency: "weekly", priority: 0.9 },
    ...clubs.map((c) => ({ url: `${SITE_URL}/clubs/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.9 },
    ...events.map((e) => ({ url: `${SITE_URL}/events/${e.id}`, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
