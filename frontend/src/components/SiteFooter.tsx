import Link from "next/link";
import { Brand } from "./Brand";

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
          <a href="/photos/credits.json">写真クレジット</a>
        </nav>
        <p>© エンジニア1st</p>
      </div>
    </footer>
  );
}
