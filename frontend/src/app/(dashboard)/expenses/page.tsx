"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { Camera, Download, PenLine, Receipt, Trash2, X } from "lucide-react";
import { apiFetch, apiUpload, ApiError, downloadFile } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { IS_DEMO } from "../../../lib/demo";
import { yen } from "../../../lib/format";
import { todayJst } from "../../../components/TaskRow";

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

// 勘定科目（フリーランスのエンジニアがよく使うもの）
const CATEGORY_OPTIONS: { value: string; hint: string }[] = [
  { value: "旅費交通費", hint: "電車・バス・タクシー・出張の宿泊" },
  { value: "地代家賃", hint: "コワーキングスペース・自宅の事業使用分" },
  { value: "通信費", hint: "スマホ・ネット回線・サーバー・ドメイン" },
  { value: "消耗品費", hint: "10万円未満のPC周辺機器・文房具" },
  { value: "新聞図書費", hint: "技術書・有料記事・学習サービス" },
  { value: "会議費", hint: "打ち合わせのカフェ・軽食" },
  { value: "接待交際費", hint: "取引先との会食・手土産" },
  { value: "研修費", hint: "勉強会・カンファレンスの参加費" },
  { value: "支払手数料", hint: "振込手数料・各種サービスの手数料" },
  { value: "雑費", hint: "ほかに当てはまらないもの" },
];

const CATEGORY_COLOR = ["var(--primary)", "var(--mint)", "var(--yellow)", "var(--pink)", "var(--orange)", "var(--violet)", "var(--ink-2)", "var(--line-strong)"];

const monthLabel = (ym: string) => `${Number(ym.slice(0, 4))}年${Number(ym.slice(5, 7))}月`;
const dayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [memo, setMemo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function reload() {
    apiFetch<{ expenses: Expense[] }>("/expenses")
      .then((res) => setExpenses(res.expenses))
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "経費を読み込めませんでした"));
  }

  useEffect(reload, []);

  function resetForm() {
    setDate(todayJst());
    setVendor("");
    setAmount("");
    setCategory(CATEGORY_OPTIONS[0].value);
    setMemo("");
    setRawText(null);
    setFormError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resetForm();
    setOcrLoading(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const data = await apiUpload<{ extracted: ExtractedExpense; rawText: string }>("/expenses/ocr", formData);
      const x = data.extracted;
      if (x.date) setDate(x.date);
      setVendor(x.vendor ?? "");
      setAmount(x.amount ? String(x.amount) : "");
      setRawText(data.rawText);
      setNotice(x.amount && x.date ? "読み取りました。内容を確認して保存してください。" : "一部を読み取れませんでした。空いているところを入力してください。");
    } catch (err) {
      setNotice(err instanceof ApiError ? `${err.message}。手入力で登録してください。` : "読み取れませんでした。手入力で登録してください。");
    } finally {
      setShowForm(true);
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openManualForm() {
    resetForm();
    setNotice(null);
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({ date, vendor: vendor.trim(), amount: Number(amount), category, memo: memo.trim() || null, ocrRawText: rawText }),
      });
      setShowForm(false);
      setNotice(null);
      resetForm();
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmId(null);
    setExpenses((prev) => prev?.filter((x) => x.id !== id) ?? null);
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" });
    } catch {
      reload();
    }
  }

  const today = todayJst();
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);

  const { byMonth, monthTotal, yearTotal, byCategory } = useMemo(() => {
    const list = expenses ?? [];
    const byMonth = new Map<string, Expense[]>();
    for (const x of list) {
      const ym = x.date.slice(0, 7);
      byMonth.set(ym, [...(byMonth.get(ym) ?? []), x]);
    }
    const yearList = list.filter((x) => x.date.startsWith(thisYear));
    const cat = new Map<string, number>();
    for (const x of yearList) cat.set(x.category, (cat.get(x.category) ?? 0) + x.amount);
    return {
      byMonth: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])),
      monthTotal: list.filter((x) => x.date.startsWith(thisMonth)).reduce((s, x) => s + x.amount, 0),
      yearTotal: yearList.reduce((s, x) => s + x.amount, 0),
      byCategory: [...cat.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [expenses, thisMonth, thisYear]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expenses"
        title="経費"
        description={<>レシートを撮るだけで、日付・金額・お店の名前を読み取ります。確認して保存しておけば、確定申告のときに freee・マネーフォワード クラウド会計へCSVでまとめて取り込めます。</>}
        actions={
          expenses && expenses.length > 0 ? (
            <button className="btn-secondary btn-sm" onClick={() => downloadFile("/expenses/export.csv", "expenses.csv").catch((e) => setLoadError(e.message))}>
              <Download size={14} /> CSVで出力
            </button>
          ) : undefined
        }
      />

      <section className="panel">
      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-label">今月の経費</div>
          <div className="stat-value num">{monthTotal.toLocaleString()}<small>円</small></div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">{thisYear}年の合計</div>
          <div className="stat-value num">{yearTotal.toLocaleString()}<small>円</small></div>
          <div className="stat-sub">{expenses?.filter((x) => x.date.startsWith(thisYear)).length ?? 0}件</div>
        </div>
        <div className="stat-tile" style={{ gridColumn: "1 / -1", minWidth: 0 }}>
          <div className="stat-label">科目ごとの内訳（{thisYear}年）</div>
          {byCategory.length === 0 ? (
            <div className="stat-sub">まだありません</div>
          ) : (
            <>
              <div className="reserve-bar" style={{ margin: "10px 0 8px" }}>
                {byCategory.map(([c, v], i) => (
                  <span key={c} style={{ width: `${(v / yearTotal) * 100}%`, background: CATEGORY_COLOR[i % CATEGORY_COLOR.length] }} title={`${c} ${yen(v)}`} />
                ))}
              </div>
              <div className="legend">
                {byCategory.map(([c, v], i) => (
                  <span className="legend-item" key={c}>
                    <span className="legend-swatch" style={{ background: CATEGORY_COLOR[i % CATEGORY_COLOR.length] }} /> {c} <span className="num muted">{yen(v)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      </section>

      <section className="panel stack">
        <div className="panel-head">
          <h2>
            <Receipt size={18} /> 経費を登録する
          </h2>
        </div>
        {!showForm && (
          <div className="inline">
            <label className="btn-primary" style={{ cursor: ocrLoading ? "wait" : "pointer" }}>
              <Camera size={16} /> {ocrLoading ? "読み取り中…" : "レシートを撮る・選ぶ"}
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} disabled={ocrLoading} className="sr-only" />
            </label>
            <button className="btn-secondary" onClick={openManualForm} type="button">
              <PenLine size={16} /> 手入力で登録
            </button>
            {IS_DEMO && <span className="small muted">デモ版ではレシートの読み取りは使えません（手入力はできます）</span>}
          </div>
        )}
        {ocrLoading && <div className="skeleton" style={{ height: 60 }} />}

        {showForm && (
          <form className="stack" onSubmit={handleSave}>
            {notice && <div className="callout-inline callout-info">{notice}</div>}
            <div className="form-grid">
              <label>
                日付
                <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                支払先
                <input placeholder="例：JR東日本" value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={100} required />
              </label>
              <label>
                金額（円・税込）
                <input type="number" min={1} inputMode="numeric" placeholder="例：1200" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </label>
              <label>
                勘定科目
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
                <span className="field-hint">{CATEGORY_OPTIONS.find((c) => c.value === category)?.hint}</span>
              </label>
            </div>
            <label>
              メモ <span className="field-hint">任意。何のための支出かを書いておくと、申告のときに困りません</span>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例：客先訪問の交通費" maxLength={200} />
            </label>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <div className="inline">
              <button className="btn-primary" type="submit" disabled={saving || !date || !vendor.trim() || !(Number(amount) > 0)}>
                {saving ? "保存中…" : "この内容で保存"}
              </button>
              <button className="btn-ghost" onClick={() => setShowForm(false)} type="button">
                キャンセル
              </button>
            </div>
            {rawText && <p className="disclaimer">レシートの読み取りは完全ではありません。保存する前に、金額・日付・支払先を確認してください。</p>}
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>登録した経費</h2>
          {expenses && <span className="small muted">{expenses.length}件</span>}
        </div>
        {loadError && <div className="form-error" role="alert">{loadError}</div>}
        {!expenses && !loadError && <div className="skeleton" style={{ height: 200 }} />}
        {expenses && expenses.length === 0 && <div className="empty-state">まだ経費はありません。レシートを撮るところから始めましょう。</div>}
        {byMonth.map(([ym, list]) => (
          <div key={ym} style={{ marginTop: 12 }}>
            <div className="spread small" style={{ fontWeight: 700, color: "var(--ink-2)", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
              <span>{monthLabel(ym)}</span>
              <span className="num">{yen(list.reduce((s, x) => s + x.amount, 0))}</span>
            </div>
            <ul className="plan-list" style={{ marginTop: 0 }}>
              {list.map((x) => (
                <li key={x.id}>
                  <span className="num small muted" style={{ width: "3em", flex: "none" }}>{dayLabel(x.date)}</span>
                  <span className="plan-title">
                    {x.vendor} <span className="badge" style={{ marginLeft: 4 }}>{x.category}</span>
                    {x.memo && <span className="small muted" style={{ display: "block" }}>{x.memo}</span>}
                  </span>
                  <strong className="num">{yen(x.amount)}</strong>
                  {confirmId === x.id ? (
                    <span className="inline" style={{ gap: 4, flexWrap: "nowrap" }}>
                      <button className="btn-danger-outline btn-sm" onClick={() => handleDelete(x.id)}>削除する</button>
                      <button className="plan-delete" onClick={() => setConfirmId(null)} aria-label="やめる">
                        <X size={14} />
                      </button>
                    </span>
                  ) : (
                    <button className="plan-delete" onClick={() => setConfirmId(x.id)} aria-label={`${x.vendor}の経費を削除`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="disclaimer">CSVは freee・マネーフォワード クラウド会計の「仕訳のインポート」でそのまま読み込めます。どの科目にするか迷うものは、税理士にご確認ください。</p>
    </div>
  );
}
