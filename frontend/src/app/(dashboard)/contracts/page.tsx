"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSignature, ShieldCheck } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { useAuth } from "../../../context/AuthContext";
import { fmtDate, yen } from "../../../lib/format";

interface Contract {
  id: string;
  title: string;
  body: string;
  status: string;
  signedAt: string | null;
  signedName: string | null;
  createdAt: string;
  engagement: {
    monthlyRate: number;
    startDate: string;
    endDate: string | null;
    settlementMin: number;
    settlementMax: number;
    paymentTermDays: number;
    project: { title: string; client: string; workStyle: string };
  };
}

// 本文に添える一般条項（プロトタイプの簡易版。実際の契約は取引先ごとの条件で作成する）
const CLAUSES: { title: string; body: (c: Contract) => string }[] = [
  { title: "第1条（業務内容）", body: (c) => `受託者は、委託者の「${c.engagement.project.title}」に関するシステム開発業務（準委任）を行う。成果物の完成義務は負わない。` },
  { title: "第2条（契約期間）", body: (c) => `${fmtDate(c.engagement.startDate)}から${c.engagement.endDate ? fmtDate(c.engagement.endDate) : "別途定める日"}まで。期間満了の30日前までに双方から申し出がないときは、同条件で1か月ずつ更新する。` },
  { title: "第3条（報酬と精算）", body: (c) => `月額${yen(c.engagement.monthlyRate)}（税抜）。当月の稼働が${c.engagement.settlementMin}時間を下回る場合は控除、${c.engagement.settlementMax}時間を超える場合は超過分を精算する。` },
  { title: "第4条（支払）", body: (c) => `月末締め、翌月末日を目安に、締め日から${c.engagement.paymentTermDays}日以内に受託者の指定口座へ振り込む（フリーランス法にもとづき、60日を超えない）。` },
  { title: "第5条（秘密保持）", body: () => "双方は、業務上知り得た相手方の秘密情報を第三者に開示・漏えいしない。契約終了後も3年間有効とする。" },
  { title: "第6条（知的財産）", body: () => "業務の過程で作成されたプログラム等の著作権は、報酬の支払完了をもって委託者に移転する。受託者が従前から保有する汎用的なノウハウ・コードはこの限りでない。" },
  { title: "第7条（再委託）", body: () => "受託者は、委託者の書面による承諾なく、業務の全部または一部を第三者に再委託しない。" },
  { title: "第8条（中途解約）", body: () => "双方は、30日前までに書面で通知することにより、本契約を解約できる。" },
];

const normalize = (s: string) => s.replace(/[\s　]/g, "");

export default function ContractsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    apiFetch<{ contracts: Contract[] }>("/contracts")
      // 未締結を先に並べる
      .then((res) => setContracts([...res.contracts].sort((a, b) => Number(a.status === "締結済み") - Number(b.status === "締結済み"))))
      .catch((e) => setError(e instanceof ApiError ? e.message : "契約書を読み込めませんでした"));
  }

  useEffect(reload, []);

  function startSigning(id: string) {
    setSigningId(id);
    setSignedName("");
    setAgreed(false);
    setError(null);
  }

  async function handleSign(e: FormEvent, contractId: string) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/contracts/${contractId}/sign`, { method: "POST", body: JSON.stringify({ signedName: signedName.trim() }) });
      setSigningId(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "締結に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const unsigned = contracts?.filter((c) => c.status !== "締結済み").length ?? 0;
  const nameMatches = !!user && normalize(signedName) === normalize(user.name);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Contracts"
        title="契約書"
        description={<>業務委託契約書の確認と電子締結ができます。報酬・精算幅・支払期日は、請求書づくりにもそのまま使われます。</>}
      />

      {unsigned > 0 && (
        <div className="callout-inline callout-warning" role="status">
          <AlertTriangle size={16} />
          <div>
            未締結の契約書が<strong>{unsigned}件</strong>あります。稼働開始の前に、内容を確認して締結してください。
          </div>
        </div>
      )}

      {error && !signingId && <div className="form-error" role="alert">{error}</div>}

      {!contracts && !error && <div className="skeleton" style={{ height: 240 }} />}

      {contracts && contracts.length === 0 && (
        <div className="empty-state">
          <FileSignature size={22} />
          <p>契約書はまだありません。エンジニア・ガレージ経由の案件が決まると、ここに契約書が届きます。</p>
          <Link href="/projects" className="btn-secondary btn-sm">
            案件をさがす <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="money-list">
        {contracts?.map((c) => {
          const signed = c.status === "締結済み";
          const e = c.engagement;
          return (
            <article className="panel money-card" key={c.id}>
              <div className="money-card-header">
                <div>
                  <div className="money-card-title">{c.title}</div>
                  <div className="card-sub">
                    {e.project.title}（{e.project.client}）
                  </div>
                </div>
                <span className={"badge " + (signed ? "badge-success" : "badge-warning")}>{c.status}</span>
              </div>

              <dl className="info-table">
                <dt>契約期間</dt>
                <dd>
                  {fmtDate(e.startDate)} 〜 {e.endDate ? fmtDate(e.endDate) : "定めなし（自動更新）"}
                </dd>
                <dt>月額報酬（税抜）</dt>
                <dd className="num">{yen(e.monthlyRate)}</dd>
                <dt>精算幅</dt>
                <dd>
                  {e.settlementMin}〜{e.settlementMax}時間
                </dd>
                <dt>支払期日</dt>
                <dd>月末締め・{e.paymentTermDays}日以内</dd>
                <dt>働き方</dt>
                <dd>{e.project.workStyle}</dd>
              </dl>

              <p className="project-desc">{c.body}</p>

              <details className="faq" style={{ maxWidth: "none" }}>
                <summary style={{ padding: "8px 0" }}>条項の全文を読む</summary>
                <div className="stack" style={{ gap: 10, paddingBottom: 8 }}>
                  {CLAUSES.map((cl) => (
                    <div key={cl.title}>
                      <strong className="small">{cl.title}</strong>
                      <p className="small" style={{ color: "var(--ink-2)", margin: 0 }}>
                        {cl.body(c)}
                      </p>
                    </div>
                  ))}
                </div>
              </details>

              {signed ? (
                <div className="callout-inline callout-success">
                  <CheckCircle2 size={16} />
                  <div>
                    {c.signedName} さんが {c.signedAt && fmtDate(c.signedAt)} に締結しました。
                  </div>
                </div>
              ) : signingId === c.id ? (
                <form className="stack" onSubmit={(ev) => handleSign(ev, c.id)} style={{ padding: 16, borderRadius: 14, background: "var(--paper)" }}>
                  <label className="checkbox-label" style={{ fontSize: 13.5 }}>
                    <input type="checkbox" checked={agreed} onChange={(ev) => setAgreed(ev.target.checked)} />
                    契約条件と条項の全文を確認し、内容に同意します
                  </label>
                  <label>
                    署名（登録しているお名前を入力） <span className="field-hint">{user?.name}</span>
                    <input value={signedName} onChange={(ev) => setSignedName(ev.target.value)} autoComplete="name" required />
                  </label>
                  {signedName && !nameMatches && <span className="small" style={{ color: "var(--danger)" }}>登録しているお名前と一致しません</span>}
                  {error && <div className="form-error" role="alert">{error}</div>}
                  <div className="inline">
                    <button className="btn-primary" type="submit" disabled={!agreed || !nameMatches || submitting}>
                      <FileSignature size={16} /> {submitting ? "締結中…" : "同意して締結する"}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setSigningId(null)}>
                      キャンセル
                    </button>
                  </div>
                </form>
              ) : (
                <button className="btn-primary" style={{ justifySelf: "start" }} onClick={() => startSigning(c.id)}>
                  内容を確認して締結する
                </button>
              )}
            </article>
          );
        })}
      </div>

      {contracts && contracts.length > 0 && (
        <p className="disclaimer inline" style={{ gap: 6 }}>
          <ShieldCheck size={14} /> 締結すると、同意した日時とお名前が記録されます。プロトタイプのため、法的な電子署名（電子証明書・タイムスタンプ）には対応していません。
        </p>
      )}
    </div>
  );
}
