"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import type { InvoiceDocument } from "@shared/invoice";
import { apiFetch, ApiError, downloadFile } from "../../../api/client";
import { PrintShell } from "../../../components/PrintShell";
import { InvoiceSheet } from "../../../components/InvoiceSheet";
import { IS_DEMO } from "../../../lib/demo";

function InvoicePrint() {
  const id = useSearchParams().get("id");
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [error, setError] = useState<string | null>(id ? null : "請求書が指定されていません");

  useEffect(() => {
    if (!id) return;
    apiFetch<{ document: InvoiceDocument }>(`/money/invoices/${id}/document`)
      .then((r) => {
        setDoc(r.document);
        document.title = `${r.document.title} ${r.document.number}`;
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "請求書を読み込めませんでした"));
  }, [id]);

  return (
    <PrintShell
      back="/money"
      backLabel="請求・入金に戻る"
      actions={
        !IS_DEMO && doc && id ? (
          <button className="btn-secondary btn-sm" onClick={() => downloadFile(`/money/invoices/${id}/pdf`, `${doc.number}.pdf`)}>
            <Download size={14} /> PDFをダウンロード
          </button>
        ) : undefined
      }
    >
      {error && <div className="form-error" style={{ maxWidth: 820, margin: "0 auto" }}>{error}</div>}
      {!doc && !error && <div className="skeleton" style={{ height: 800, maxWidth: 820, width: "100%", margin: "0 auto" }} />}
      {doc && <InvoiceSheet doc={doc} />}
    </PrintShell>
  );
}

export default function InvoicePrintPage() {
  return (
    <Suspense>
      <InvoicePrint />
    </Suspense>
  );
}
