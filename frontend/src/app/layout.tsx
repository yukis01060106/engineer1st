import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Zen_Kaku_Gothic_New, Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";
import { DemoBanner } from "../components/DemoBanner";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "../lib/site";

// 本文
const notoSansJP = Noto_Sans_JP({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

// 見出し: 太く、少し角のあるゴシック
const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
  preload: false,
});

// 欧文ラベル・数字
const heebo = Heebo({
  variable: "--font-latin",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | エンジニアの、からだと、くらしと、仲間。`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/photos/hero.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} ${zenKaku.variable} ${heebo.variable}`}>
        <DemoBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
