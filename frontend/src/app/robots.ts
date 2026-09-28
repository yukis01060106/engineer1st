import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export const dynamic = "force-static";

// ログイン必須の個人データ画面はクロール対象外にする
const DASHBOARD_PATHS = [
  "/mypage",
  "/calendar",
  "/print",
  "/money",
  "/expenses",
  "/wealth",
  "/reward-sim",
  "/community",
  "/health",
  "/mentor",
  "/chat",
  "/projects",
  "/skill-sheet",
  "/rate-diagnosis",
  "/skill-gap",
  "/contracts",
  "/settings",
  "/admin",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: DASHBOARD_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
