"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Briefcase,
  FileText,
  Gauge,
  BarChart3,
  FileSignature,
  Receipt,
  Wallet,
  Calculator,
  PiggyBank,
  HeartPulse,
  Users,
  MessageCircleQuestion,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { Brand } from "./Brand";
import { useAuth, User } from "../context/AuthContext";
import { WORK_STYLE_LABEL } from "../lib/format";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  // 表示する条件（未指定なら全員）
  show?: (u: User) => boolean;
}

const isFreelance = (u: User) => u.workStyle === "freelance";

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Home", items: [{ to: "/mypage", label: "ホーム", icon: Home }] },
  {
    label: "Body & Friends",
    items: [
      { to: "/community", label: "部活・勉強会", icon: Users },
      { to: "/health", label: "健康", icon: HeartPulse },
      { to: "/mentor", label: "メンター相談", icon: MessageCircleQuestion },
      { to: "/chat", label: "担当者チャット", icon: MessagesSquare },
    ],
  },
  {
    label: "Paperwork",
    items: [
      { to: "/money", label: "請求・入金・税金", icon: Receipt, show: isFreelance },
      { to: "/expenses", label: "経費", icon: Wallet, show: isFreelance },
      { to: "/contracts", label: "契約", icon: FileSignature, show: isFreelance },
    ],
  },
  {
    label: "Future Plan",
    items: [
      { to: "/wealth", label: "将来の備え・AI FP", icon: PiggyBank },
      { to: "/reward-sim", label: "手取りシミュレーション", icon: Calculator },
    ],
  },
  {
    label: "Career",
    items: [
      { to: "/projects", label: "案件をさがす", icon: Briefcase },
      { to: "/skill-sheet", label: "スキルシート", icon: FileText },
      { to: "/rate-diagnosis", label: "単価・商流診断", icon: Gauge },
      { to: "/skill-gap", label: "スキルギャップ", icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/settings", label: "設定", icon: Settings },
      { to: "/admin", label: "運営：見込み客・告知", icon: ShieldCheck, show: (u) => u.role === "admin" },
    ],
  },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) return <div className="loading-screen">読み込み中…</div>;

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const moneyTab = isFreelance(user) ? "/money" : "/reward-sim";

  const tabs = [
    { to: "/mypage", label: "ホーム", icon: Home },
    { to: moneyTab, label: isFreelance(user) ? "請求" : "備え", icon: Receipt },
    { to: "/community", label: "部活・勉強会", icon: Users },
    { to: "/health", label: "健康", icon: HeartPulse },
  ];

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <Brand href="/mypage" />
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="メニューを開く">
          <Menu size={22} />
        </button>
      </div>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside
        className={"sidebar" + (menuOpen ? " open" : "")}
        aria-label="アプリのメニュー"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
        }}
      >
        <div className="spread">
          <Brand href="/mypage" />
          {menuOpen && (
            <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="メニューを閉じる">
              <X size={20} />
            </button>
          )}
        </div>
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((i) => !i.show || i.show(user));
          if (items.length === 0) return null;
          return (
            <nav className="nav-group" key={g.label} aria-label={g.label}>
              <div className="nav-group-label">{g.label}</div>
              {items.map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  className={"nav-link" + (isActive(item.to) ? " active" : "")}
                  aria-current={isActive(item.to) ? "page" : undefined}
                >
                  <item.icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
              ))}
            </nav>
          );
        })}
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden>
            {user.name.slice(0, 1)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{user.name}</div>
            <div className="user-meta">{WORK_STYLE_LABEL[user.workStyle]}</div>
          </div>
          <button
            className="icon-btn"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              logout();
              router.push("/");
            }}
            aria-label="ログアウト"
            title="ログアウト"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>

      <nav className="tabbar" aria-label="タブ">
        {tabs.map((t) => (
          <Link key={t.label} href={t.to} className={isActive(t.to) ? "active" : ""}>
            <t.icon size={22} />
            {t.label}
          </Link>
        ))}
        <button onClick={() => setMenuOpen(true)}>
          <Menu size={22} />
          メニュー
        </button>
      </nav>
    </div>
  );
}
