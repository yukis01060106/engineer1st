import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Receipt,
  BellRing,
  PiggyBank,
  Calculator,
  FileText,
  Gauge,
  ScanLine,
  Landmark,
  MapPin,
  Clock,
  Video,
  Users,
} from "lucide-react";
import { SiteLayout } from "../components/SiteLayout";
import { Photo } from "../components/Photo";
import { Reveal } from "../components/Reveal";
import { EventDate } from "../components/EventDate";
import { ClubCard } from "../components/ClubCard";
import { serverFetchOr } from "../lib/serverApi";
import { dateParts } from "../lib/format";
import type { ClubSummary, EventItem } from "../lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "ソトバ | エンジニアの、からだと、くらしと、仲間。" },
  description:
    "フリーランス・SESエンジニアのための無料プラットフォーム。ピックルボール部・筋トレ部などの部活、最新技術のオンライン勉強会、請求書・入金管理・税金の取り分け・AI FPによる資産形成までまとめてサポート。",
  alternates: { canonical: "/" },
};

const PAINS = [
  {
    stat: "58.9",
    unit: "%",
    title: "取引先とのトラブルを経験",
    body: "いちばん多いのは「報酬の支払い遅延・不払い」（49.1%）。契約書を必ず交わす人は28.1%にとどまります。",
    source: "PE-BANK「フリーランス新法に関する実態調査」2024年・ITフリーランス360名",
  },
  {
    stat: "3〜4",
    unit: "週間",
    title: "案件が切れたあとの収入ゼロ期間",
    body: "契約が終わってから探し始めると、面談・スキルシート確認・契約手続きだけで最低でも3〜4週間。有給も失業給付もありません。",
    source: "フリーランスエージェント各社の公開情報より",
  },
  {
    stat: "77.0",
    unit: "%",
    title: "消費税を価格に上乗せできていない",
    body: "インボイス登録した課税事業者の90.8%が消費税を負担に感じています。6月の住民税・国保の通知で慌てる人も少なくありません。",
    source: "STOP!インボイス「1万人のインボイス実態調査」2025年",
  },
];

const TOOLS = [
  { icon: Receipt, title: "請求書の自動作成", body: "精算幅の超過・控除、インボイス、源泉徴収まで。稼働時間を入れるだけ。" },
  { icon: BellRing, title: "入金チェックと催促文", body: "支払期日を過ぎたらお知らせ。フリーランス法にもとづく丁寧な催促文をワンクリックで。" },
  { icon: Landmark, title: "税金の取り分け目安", body: "入金のたびに、住民税・国保・消費税のために残しておく額を表示。" },
  { icon: PiggyBank, title: "資産形成 × AI FP", body: "契約単価と更新時期をもとに、共済・iDeCo・NISAの積立額をあなたの数字で試算。" },
  { icon: Calculator, title: "手取りシミュレーション", body: "単価から手取りを概算。SES会社員の方は、独立した場合との比較も。" },
  { icon: FileText, title: "スキルシート自動生成", body: "足りない項目だけ入力すれば、Excelのスキルシートとサマリーを自動で作成。" },
  { icon: Gauge, title: "単価・商流診断", body: "似た条件のエンジニアと比べて、単価と商流の深さの目安を確認。" },
  { icon: ScanLine, title: "経費のレシート読み取り", body: "撮るだけで日付・金額・店名を読み取り、会計ソフト用のCSVに。" },
];

const FAQ = [
  {
    q: "本当に無料ですか？",
    a: "はい。会員登録、部活・勉強会への参加、請求書などのツールはすべて無料です。部活の施設利用料（コート代など）だけ、参加者で実費を割り勘にしています。",
  },
  {
    q: "登録すると、案件の営業電話がかかってきますか？",
    a: "いいえ。案件のご紹介は、あなたが「案件をさがす」を開いたときや、契約終了が近づいたときにアプリ内でお知らせするだけです。電話での営業はしません。",
  },
  {
    q: "SESの会社に勤めていても参加できますか？",
    a: "できます。部活・勉強会・健康メニュー・資産形成・手取りシミュレーションは会社員の方もそのまま使えます。いまの会社のまま、横のつながりと学びの場として使ってください。",
  },
  {
    q: "入力した契約や請求のデータは、何に使われますか？",
    a: "あなた自身の画面（請求・税金の目安・AI FPの回答）をつくるためにだけ使います。本人の同意なく第三者に渡したり、AIの学習に使ったりすることはありません。",
  },
  {
    q: "AI FPに投資商品を選んでもらえますか？",
    a: "特定の商品や銘柄はおすすめしません（投資助言にあたるため）。制度のしくみと、あなたのデータを使った試算までをお手伝いし、個別のご相談は提携のFP・税理士におつなぎします。",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "ソトバ",
  serviceType: "フリーランス・SESエンジニア支援プラットフォーム",
  description:
    "部活・勉強会・健康推進と、請求書・入金管理・税金の取り分け・資産形成をまとめて支援する無料プラットフォーム。",
  areaServed: "JP",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  audience: { "@type": "Audience", audienceType: "フリーランスエンジニア・SESエンジニア" },
};

export default async function LandingPage() {
  const [{ clubs }, { events }] = await Promise.all([
    serverFetchOr<{ clubs: ClubSummary[] }>("/clubs", { clubs: [] }, 300),
    serverFetchOr<{ events: EventItem[] }>("/events?type=勉強会", { events: [] }, 300),
  ]);
  const studies = events.slice(0, 3);

  return (
    <SiteLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <Reveal>
              <span className="eyebrow">For Freelance &amp; SES Engineers</span>
            </Reveal>
            <Reveal as="h1" className="hero-title" delay={80}>
              エンジニアの、
              <br />
              からだと、
              <br />
              くらしと、
              <br />
              <span className="marker">仲間</span>。
            </Reveal>
            <Reveal as="p" className="hero-lead" delay={160}>
              座りっぱなしの毎日に、部活と勉強会を。
              <br />
              請求・入金・税金・資産形成は、アプリがまとめて見守ります。
              フリーランスも、SESで働く人も、無料で使えます。
            </Reveal>
            <Reveal className="hero-actions" delay={240}>
              <Link href="/clubs" className="btn-primary btn-lg">
                部活をのぞいてみる <ArrowRight size={18} />
              </Link>
              <Link href="/register" className="btn-secondary btn-lg">
                無料で登録する
              </Link>
            </Reveal>
            <Reveal as="p" className="hero-note" delay={300}>
              登録30秒・営業電話なし・案件の紹介は必要なときだけ
            </Reveal>
          </div>

          <Reveal delay={120}>
            <Photo
              src="/photos/hero.webp"
              alt="ノートパソコンを囲んで笑い合うエンジニアたち"
              className="hero-photo"
              blob="yellow"
              extraBlob="pink"
              priority
            >
              <div className="hero-badge">
                <Users size={28} />
                <div>
                  <strong>{clubs.filter((c) => c.status === "open").length || 2}</strong>つの部活が活動中
                  <div className="small muted">毎月の勉強会はオンライン</div>
                </div>
              </div>
            </Photo>
          </Reveal>
        </div>
      </section>

      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {Array.from({ length: 2 }).flatMap((_, k) =>
            ["PICKLEBALL", "TRAINING", "STUDY", "INVOICE", "TAX", "WEALTH", "COMMUNITY", "CAREER"].map((w) => (
              <span key={`${k}-${w}`}>{w}</span>
            ))
          )}
        </div>
      </div>

      {/* ---------- 悩み ---------- */}
      <section className="section section-paper">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">Why</span>
            <h2>
              フリーランスが困るのは、
              <br />
              コードの外側でした。
            </h2>
            <p>調べてみると、つまずきの多くは「請求や税金などの事務」と「ひとりで抱えること」に集まっていました。</p>
          </Reveal>
          <div className="pain-grid">
            {PAINS.map((p, i) => (
              <Reveal key={p.title} className="pain-card" delay={i * 100}>
                <div className="pain-stat">
                  {p.stat}
                  <small>{p.unit}</small>
                </div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <span className="pain-source">出典：{p.source}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 3本柱 ---------- */}
      <section className="section">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">What we do</span>
            <h2>ひとりで抱えない、3つのしくみ。</h2>
          </Reveal>

          <div>
            <div className="pillar">
              <Reveal>
                <Photo src="/photos/community.webp" alt="肩を組んで海を眺める仲間たち" className="pillar-photo" blob="mint" />
              </Reveal>
              <Reveal className="pillar-body" delay={100}>
                <span className="pillar-num">01 — BODY &amp; FRIENDS</span>
                <h3>部活で、からだと仲間を。</h3>
                <p className="muted">
                  いまはピックルボール部と筋トレ部が活動中。ランニングやボルダリングなども準備しています。現場も会社もバラバラなエンジニアが、体を動かしながら自然に知り合えます。
                </p>
                <ul className="pillar-list">
                  <li><Check size={18} /> 参加は無料登録だけ。道具はレンタルできる部がほとんど</li>
                  <li><Check size={18} /> 歩数・睡眠・気分の記録と、健康診断のリマインド</li>
                  <li><Check size={18} /> 1時間に1回の「座りっぱなしリセット」ストレッチ</li>
                </ul>
                <Link href="/clubs" className="btn-link">
                  部活の一覧を見る <ArrowRight size={16} />
                </Link>
              </Reveal>
            </div>

            <div className="pillar">
              <Reveal>
                <Photo src="/photos/study.webp" alt="勉強会で発表するエンジニア" className="pillar-photo" blob="violet" />
              </Reveal>
              <Reveal className="pillar-body" delay={100}>
                <span className="pillar-num">02 — STUDY</span>
                <h3>最新技術は、毎月の勉強会で。</h3>
                <p className="muted">
                  生成AIの開発フロー、フレームワークの変更点、単価を上げるためのキャリアの話まで。SESの現場でAIツールが使えない人も、ここで試せます。
                </p>
                <ul className="pillar-list">
                  <li><Check size={18} /> 申込フォームを送ると、その場で参加URLを発行</li>
                  <li><Check size={18} /> カレンダー登録（.ics / Googleカレンダー）にワンタップ</li>
                  <li><Check size={18} /> 事前質問で、聞きたいことを講師に届けられる</li>
                </ul>
                <Link href="/events" className="btn-link">
                  勉強会の予定を見る <ArrowRight size={16} />
                </Link>
              </Reveal>
            </div>

            <div className="pillar">
              <Reveal>
                <Photo src="/photos/money.webp" alt="コードが表示されたノートパソコンと黄色いマグカップ" className="pillar-photo" blob="yellow" />
              </Reveal>
              <Reveal className="pillar-body" delay={100}>
                <span className="pillar-num">03 — PAPERWORK &amp; PLAN</span>
                <h3>事務と将来の備えは、アプリが先回り。</h3>
                <p className="muted">
                  請求書をつくったら、入金まで見守ります。入金があれば、税金の取り分けと、共済・iDeCo・NISAへの積立の目安までその場で。
                </p>
                <ul className="pillar-list">
                  <li><Check size={18} /> 支払期日を過ぎたら通知。フリーランス法にもとづく催促文つき</li>
                  <li><Check size={18} /> インボイスの2割・3割特例を反映した消費税の目安</li>
                  <li><Check size={18} /> 契約単価と更新時期を知っているAI FPに、いつでも相談</li>
                </ul>
                <Link href="#tools" className="btn-link">
                  無料ツールを見る <ArrowRight size={16} />
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 部活 ---------- */}
      <section className="section section-paper" id="clubs">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">Clubs</span>
            <h2>
              まずは、<span className="marker">部活</span>からどうぞ。
            </h2>
            <p>参加に必要なのは、無料の会員登録だけ。登録するとそのまま入部でき、次回の集合場所や参加URLがアプリに届きます。</p>
          </Reveal>
          <div className="club-grid">
            {clubs.map((c, i) => (
              <Reveal key={c.slug} delay={i * 80}>
                <ClubCard club={c} />
              </Reveal>
            ))}
          </div>

          <div className="steps" style={{ marginTop: 48 }}>
            <Reveal className="step">
              <h3>無料で登録（30秒）</h3>
              <p>働き方と興味を選んで、メールアドレスを入れるだけ。</p>
            </Reveal>
            <Reveal className="step" delay={100}>
              <h3>部活・勉強会を選ぶ</h3>
              <p>気になる部に入部して、次の活動に申し込みます。</p>
            </Reveal>
            <Reveal className="step" delay={200}>
              <h3>参加URL・集合場所が届く</h3>
              <p>オンラインは参加URLを、現地は集合場所をアプリでお知らせ。</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- 勉強会 ---------- */}
      <section className="section">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">Study</span>
            <h2>次のオンライン勉強会</h2>
          </Reveal>
          <div className="event-list">
            {studies.length === 0 && <div className="empty-state">予定を準備中です</div>}
            {studies.map((e, i) => (
              <Reveal key={e.id} delay={i * 80}>
                <Link href={`/events/${e.id}`} className="event-row">
                  <EventDate date={e.date} />
                  <div className="event-body">
                    <h3>{e.title}</h3>
                    <div className="event-meta">
                      <span>
                        <Clock size={14} /> {dateParts(e.date).time}〜（{e.durationMin}分）
                      </span>
                      <span>
                        {e.isOnline ? <Video size={14} /> : <MapPin size={14} />} {e.location}
                      </span>
                      {e.speaker && <span>講師：{e.speaker}</span>}
                    </div>
                  </div>
                  <span className="btn-secondary btn-sm">
                    詳細・申込 <ArrowRight size={14} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <Link href="/events" className="btn-link">
              すべての予定を見る <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- 無料ツール ---------- */}
      <section className="section section-paper" id="tools">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">Free Tools</span>
            <h2>コードの外側の仕事は、ぜんぶ無料で。</h2>
            <p>案件を紹介されなくても、ずっと無料で使えます。データはあなたの画面をつくるためだけに使います。</p>
          </Reveal>
          <div className="quick-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {TOOLS.map((t, i) => (
              <Reveal key={t.title} className="pain-card" delay={(i % 4) * 60}>
                <span className="quick-icon" style={{ background: ["var(--yellow)", "var(--pink)", "var(--mint-soft)", "var(--violet-soft)"][i % 4] }}>
                  <t.icon size={20} />
                </span>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SES / フリーランス ---------- */}
      <section className="section" id="ses">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">For You</span>
            <h2>いまの働き方のままで、使えます。</h2>
          </Reveal>
          <div className="split-callout">
            <Reveal className="callout callout-mint">
              <span className="badge badge-mint">SESで働く方へ</span>
              <h3>会社の外に、仲間と学びの場を。</h3>
              <ul>
                <li>現場がバラバラでも、部活で同世代のエンジニアとつながれる</li>
                <li>現場で使えない生成AIツールを、勉強会で先に試せる</li>
                <li>「独立したら手取りはいくら？」を、いまの年収と比べて試算</li>
                <li>NISA・iDeCoの始め方を、AI FPに気軽に相談</li>
              </ul>
              <Link href="/register?style=ses_employee" className="btn-primary" style={{ justifySelf: "start" }}>
                会社員のまま登録する <ArrowRight size={16} />
              </Link>
            </Reveal>
            <Reveal className="callout callout-yellow" delay={100}>
              <span className="badge badge-yellow">フリーランスの方へ</span>
              <h3>「弱いところ」だけ、まかせてください。</h3>
              <ul>
                <li>請求書は稼働時間を入れるだけ。精算幅もインボイスも自動</li>
                <li>支払いの遅れは、アプリが気づいて催促文まで用意</li>
                <li>税金の取り分けと、退職金代わりの積立を毎月見える化</li>
                <li>契約終了の45日前から、次の案件を先回りでご案内</li>
              </ul>
              <Link href="/register?style=freelance" className="btn-primary" style={{ justifySelf: "start" }}>
                フリーランスとして登録する <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="section section-paper">
        <div className="container">
          <Reveal className="section-title">
            <span className="eyebrow">FAQ</span>
            <h2>よくある質問</h2>
          </Reveal>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="section">
        <div className="container">
          <Reveal className="cta">
            <span className="dots" aria-hidden />
            <span className="blob blob-pink" aria-hidden />
            <span className="eyebrow" style={{ color: "var(--yellow)" }}>
              Join us
            </span>
            <h2>
              今週末、
              <br />
              いっしょに体を動かしませんか。
            </h2>
            <p>登録は無料、30秒で終わります。部活も勉強会も、気が向いたときに参加すればOKです。</p>
            <Link href="/register" className="btn-primary btn-lg">
              無料で登録して部活に参加 <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
