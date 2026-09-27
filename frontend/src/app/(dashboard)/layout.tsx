import type { Metadata } from "next";
import { DashboardShell } from "../../components/DashboardShell";

// ログイン必須の個人データを含むため検索エンジンにはインデックスさせない
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
