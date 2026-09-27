"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, apiUpload, ApiError, downloadFile } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface Expense {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: string;
  memo: string | null;
}

interface ExtractedExpense {
  date: string | null;
  amount: number | null;
  vendor: string | null;
}

const CATEGORY_OPTIONS = [
  "旅費交通費",
  "会議費",
  "消耗品費",
  "通信費",
  "接待交際費",
  "新聞図書費",
  "雑費",
];

const yen = (n: number) => `${n.toLocaleString()}円`;

function downloadCsv() {
  return downloadFile("/expenses/export.csv", "expenses.csv");
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [memo, setMemo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function reload() {
    apiFetch<{ expenses: Expense[] }>("/expenses").then((res) => setExpenses(res.expenses));
  }

  useEffect(reload, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const data = await apiUpload<{ extracted: ExtractedExpense; rawText: string }>("/expenses/ocr", formData);

      const extracted: ExtractedExpense = data.extracted;
      setDate(extracted.date ?? "");
      setVendor(extracted.vendor ?? "");
      setAmount(extracted.amount ? String(extracted.amount) : "");
      setRawText(data.rawText);
      setShowForm(true);
    } catch (err) {
      setOcrError(err instanceof ApiError ? err.message : "OCRに失敗しました。手入力で登録してください。");
      setShowForm(true);
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openManualForm() {
    setDate("");
    setVendor("");
    setAmount("");
    setCategory(CATEGORY_OPTIONS[0]);
    setMemo("");
    setRawText(null);
    setOcrError(null);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          date,
          vendor,
          amount: Number(amount),
          category,
          memo: memo || null,
          ocrRawText: rawText,
        }),
      });
      setShowForm(false);
      setDate("");
      setVendor("");
      setAmount("");
      setMemo("");
      setRawText(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expenses"
        title="経費精算"
        description={<>レシートを撮影・アップロードするとOCRで日付・金額・店名を自動で読み取ります。内容を確認して保存し、freee・マネーフォワード クラウド会計の仕訳インポート画面で読み込めるCSVとしてまとめて出力できます。</>}
      />

      <section className="section">
        <h2>レシートを読み取る</h2>
        <div className="form-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={ocrLoading}
          />
          <button className="btn-secondary" onClick={openManualForm} type="button">
            手入力で登録する
          </button>
        </div>
        {ocrLoading && <div className="loading-screen">OCR読み取り中...</div>}
        {ocrError && <div className="form-error">{ocrError}</div>}

        {showForm && (
          <div className="experience-form">
            <div className="form-row">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input
                placeholder="支払先（例: ○○商店）"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
            <div className="form-row">
              <input
                type="number"
                placeholder="金額（円）"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="備考（任意）"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <div className="form-row">
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !date || !vendor || !amount}
              >
                {saving ? "保存中..." : "この内容で保存"}
              </button>
              <button className="btn-secondary" onClick={() => setShowForm(false)} type="button">
                キャンセル
              </button>
            </div>
            <p className="disclaimer">
              OCRの読み取り結果は完全ではありません。保存前に金額・日付・店名をご確認ください。
            </p>
          </div>
        )}
      </section>

      <section className="section">
        <div className="money-card-header">
          <h2>経費一覧</h2>
          {expenses.length > 0 && (
            <button className="btn-secondary" onClick={downloadCsv}>
              📄 CSVで出力（freee / マネーフォワード対応）
            </button>
          )}
        </div>
        {expenses.length === 0 && <div className="empty-state">経費はまだ登録されていません</div>}
        <div className="money-list">
          {expenses.map((exp) => (
            <div className="money-card" key={exp.id}>
              <div className="money-card-header">
                <div>
                  <div className="money-card-title">{exp.vendor}</div>
                  <div className="card-sub">
                    {exp.date.slice(0, 10)} ・ {exp.category}
                  </div>
                </div>
                <span className="card-main">{yen(exp.amount)}</span>
              </div>
              {exp.memo && <p className="project-desc">{exp.memo}</p>}
              <div className="money-card-actions">
                <button className="btn-danger-outline" onClick={() => handleDelete(exp.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
