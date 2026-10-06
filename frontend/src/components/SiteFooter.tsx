import Link from "next/link";
import { Brand } from "./Brand";
import { asset } from "../lib/demo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <Brand />
        <nav aria-label="フッター">
          <Link href="/clubs">部活</Link>
          <Link href="/events">勉強会・イベント</Link>
          <Link href="/register">無料登録</Link>
          <Link href="/login">ログイン</Link>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <a href={asset("/photos/credits.json")}>写真クレジット</a>
        </nav>
        <p>© エンジニア・ガレージ</p>
      </div>
    </footer>
  );
}
