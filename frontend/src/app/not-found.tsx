import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "../components/SiteLayout";

export default function NotFound() {
  return (
    <SiteLayout>
      <section className="section" style={{ paddingTop: 72 }}>
        <div className="container section-title" style={{ justifyItems: "start" }}>
          <span className="eyebrow">404 Not Found</span>
          <h2>
            ページが見つかりませんでした
          </h2>
          <p>URLが変わったか、公開が終わったページかもしれません。部活・勉強会の一覧や、ホームからさがしてみてください。</p>
          <div className="inline" style={{ marginTop: 12 }}>
            <Link href="/" className="btn-primary">
              トップへ <ArrowRight size={16} />
            </Link>
            <Link href="/clubs" className="btn-secondary">
              部活を見る
            </Link>
            <Link href="/events" className="btn-secondary">
              勉強会・イベント
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
