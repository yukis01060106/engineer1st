import type { InvoiceDocument } from "@shared/invoice";

const yen = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ja-JP")}円`;

// 請求書の見た目（発行前のプレビューと、印刷・PDF保存用ページで共通。サーバーのPDFと同じ内容）
export function InvoiceSheet({ doc, draft = false }: { doc: InvoiceDocument; draft?: boolean }) {
  return (
    <article className={"invoice-sheet" + (draft ? " is-draft" : "")} aria-label={`${doc.title} ${doc.number}`}>
      {draft && <div className="invoice-draft-mark">プレビュー</div>}
      <h1 className="invoice-title">{doc.title}</h1>

      <div className="invoice-meta">
        <div>請求書番号　{doc.number}</div>
        <div>発行日　{doc.issuedAt}</div>
        {doc.issuer.registrationNumber && <div>登録番号　{doc.issuer.registrationNumber}</div>}
      </div>

      <div className="invoice-parties">
        <div>
          <div className="invoice-recipient">{doc.recipient}　御中</div>
          <p className="invoice-subject">件名：{doc.subject}</p>
          <p className="invoice-subject">下記のとおりご請求申し上げます。</p>
        </div>
        <div className="invoice-issuer">
          {doc.issuer.businessName && <strong>{doc.issuer.businessName}</strong>}
          <strong>{doc.issuer.name}</strong>
          {doc.issuer.postalCode && <span>〒{doc.issuer.postalCode}</span>}
          {doc.issuer.address && <span>{doc.issuer.address}</span>}
          {doc.issuer.phone && <span>TEL {doc.issuer.phone}</span>}
          <span>{doc.issuer.email}</span>
        </div>
      </div>

      <div className="invoice-amount-box">
        <div>
          <span>{doc.withholding > 0 ? "ご請求金額（税込・源泉徴収後）" : "ご請求金額（税込）"}</span>
          <span>お支払期日　{doc.dueDate ?? "—"}</span>
        </div>
        <strong className="num">{yen(doc.transfer)}</strong>
      </div>
      <p className="invoice-period">取引期間（役務の提供期間）　{doc.period}</p>

      <table className="invoice-lines">
        <thead>
          <tr>
            <th>品目</th>
            <th>数量</th>
            <th>単価</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i}>
              <td>
                {l.label}
                {l.detail && <small>{l.detail}</small>}
              </td>
              <td className="num">{l.quantity}</td>
              <td className="num">{l.unitPrice != null ? yen(l.unitPrice) : ""}</td>
              <td className="num">{yen(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <dl>
          <dt>小計（税抜）</dt>
          <dd className="num">{yen(doc.subtotal)}</dd>
          <dt>消費税（{doc.taxSummary[0]?.rate ?? 10}%）</dt>
          <dd className="num">{yen(doc.taxTotal)}</dd>
          <dt className="strong">合計（税込）</dt>
          <dd className="num strong">{yen(doc.total)}</dd>
          {doc.withholding > 0 && (
            <>
              <dt>源泉徴収税額</dt>
              <dd className="num">{yen(-doc.withholding)}</dd>
              <dt className="strong">差引ご請求金額</dt>
              <dd className="num strong">{yen(doc.transfer)}</dd>
            </>
          )}
        </dl>
        {doc.taxSummary.map((t) => (
          <p key={t.rate} className="invoice-taxline">
            {t.rate}%対象　{yen(t.base)}（税抜）　消費税　{yen(t.tax)}
          </p>
        ))}
      </div>

      <div className="invoice-bank">
        <strong>お振込先</strong>
        {doc.bankLines.length > 0 ? (
          <div>
            {doc.bankLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        ) : (
          <div className="invoice-missing">（振込先が未登録です。設定画面で登録してください）</div>
        )}
      </div>

      <div className="invoice-notes">
        <strong>備考</strong>
        <ul>
          {doc.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
