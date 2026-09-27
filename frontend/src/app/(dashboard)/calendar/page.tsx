"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, Plus } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { Task, TaskRow, WEEKDAYS, labelOf, todayJst } from "../../../components/TaskRow";


interface AutoItem {
  id: string;
  date: string;
  time: string | null;
  title: string;
  source: "event" | "invoice" | "engagement";
  path: string;
}

const SOURCE_LABEL: Record<AutoItem["source"], string> = { event: "勉強会・部活", invoice: "入金期日", engagement: "契約" };


const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function CalendarPage() {
  const today = todayJst();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [auto, setAuto] = useState<AutoItem[]>([]);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [selected, setSelected] = useState(today);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム（選んだ日）
  const [kind, setKind] = useState<Task["kind"]>("event");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  // ToDoのすばやい追加
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDate, setTodoDate] = useState("");
  const [showDone, setShowDone] = useState(false);

  function reload() {
    apiFetch<{ tasks: Task[]; auto: AutoItem[] }>("/planner")
      .then((res) => {
        setTasks(res.tasks);
        setAuto(res.auto);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "読み込めませんでした"));
  }
  useEffect(reload, []);

  async function create(body: Partial<Task>) {
    setError(null);
    try {
      await apiFetch("/planner/tasks", { method: "POST", body: JSON.stringify(body) });
      reload();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "追加できませんでした");
      return false;
    }
  }

  async function toggle(t: Task) {
    setTasks((prev) => prev?.map((x) => (x.id === t.id ? { ...x, doneAt: t.doneAt ? null : new Date().toISOString() } : x)) ?? null);
    try {
      await apiFetch(`/planner/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.doneAt }) });
    } catch {
      reload();
    }
  }

  async function remove(t: Task) {
    setTasks((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
    try {
      await apiFetch(`/planner/tasks/${t.id}`, { method: "DELETE" });
    } catch {
      reload();
    }
  }

  async function addToDay(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (await create({ title, kind, date: selected, time: time || null })) {
      setTitle("");
      setTime("");
    }
  }

  async function addTodo(e: FormEvent) {
    e.preventDefault();
    if (!todoTitle.trim()) return;
    if (await create({ title: todoTitle, kind: "todo", date: todoDate || null })) {
      setTodoTitle("");
      setTodoDate("");
    }
  }

  // 日付ごとの予定
  const byDate = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; auto: AutoItem[] }>();
    const slot = (d: string) => map.get(d) ?? (map.set(d, { tasks: [], auto: [] }), map.get(d)!);
    for (const t of tasks ?? []) if (t.date) slot(t.date).tasks.push(t);
    for (const a of auto) slot(a.date).auto.push(a);
    return map;
  }, [tasks, auto]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const list: (string | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) list.push(ymd(cursor.y, cursor.m, d));
    while (list.length % 7) list.push(null);
    return list;
  }, [cursor]);

  const move = (delta: number) => setCursor(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const goToday = () => {
    const [y, m] = today.split("-").map(Number);
    setCursor({ y, m: m - 1 });
    setSelected(today);
  };

  const todos = (tasks ?? []).filter((t) => t.kind === "todo");
  const open = todos.filter((t) => !t.doneAt);
  const groups = [
    { key: "overdue", label: "期限切れ", items: open.filter((t) => t.date && t.date < today), tone: "var(--danger)" },
    { key: "today", label: "今日", items: open.filter((t) => t.date === today) },
    { key: "later", label: "これから", items: open.filter((t) => t.date && t.date > today) },
    { key: "nodate", label: "日付なし", items: open.filter((t) => !t.date) },
  ];
  const done = todos.filter((t) => t.doneAt);
  const day = byDate.get(selected);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Calendar & ToDo"
        title="カレンダー・ToDo"
        description={<>自分の予定とやることを管理できます。申し込んだ勉強会・部活、請求の入金期日、契約終了日は自動でカレンダーに入ります。</>}
      />

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="grid-main-side">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>
                <CalendarDays size={18} /> {cursor.y}年{cursor.m + 1}月
              </h2>
              <div className="inline" style={{ gap: 6 }}>
                <button className="icon-btn" onClick={() => move(-1)} aria-label="前の月">
                  <ChevronLeft size={18} />
                </button>
                <button className="btn-secondary btn-sm" onClick={goToday}>
                  今日
                </button>
                <button className="icon-btn" onClick={() => move(1)} aria-label="次の月">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="cal-grid" role="grid" aria-label={`${cursor.y}年${cursor.m + 1}月`}>
              {WEEKDAYS.map((w, i) => (
                <div key={w} className={"cal-weekday" + (i === 0 ? " is-sun" : i === 6 ? " is-sat" : "")}>
                  {w}
                </div>
              ))}
              {cells.map((date, i) => {
                if (!date) return <div key={`blank-${i}`} className="cal-cell is-blank" />;
                const items = byDate.get(date);
                const entries = [
                  ...(items?.auto.map((a) => ({ id: a.id, title: a.title, cls: `cal-dot-${a.source}`, done: false })) ?? []),
                  ...(items?.tasks.map((t) => ({ id: t.id, title: t.title, cls: t.kind === "event" ? "cal-dot-mine" : "cal-dot-todo", done: !!t.doneAt })) ?? []),
                ];
                return (
                  <button
                    key={date}
                    className={"cal-cell" + (date === today ? " is-today" : "") + (date === selected ? " is-selected" : "")}
                    onClick={() => setSelected(date)}
                    aria-pressed={date === selected}
                    aria-label={`${labelOf(date)} ${entries.length}件`}
                  >
                    <span className="cal-day">{Number(date.slice(8))}</span>
                    <span className="cal-items">
                      {entries.slice(0, 3).map((x) => (
                        <span key={x.id} className={"cal-item " + x.cls + (x.done ? " is-done" : "")}>
                          {x.title}
                        </span>
                      ))}
                      {entries.length > 3 && <span className="cal-more">+{entries.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="legend" style={{ marginTop: 12 }}>
              <span className="legend-item"><span className="legend-swatch cal-dot-mine" /> 自分の予定</span>
              <span className="legend-item"><span className="legend-swatch cal-dot-todo" /> ToDo</span>
              <span className="legend-item"><span className="legend-swatch cal-dot-event" /> 勉強会・部活</span>
              <span className="legend-item"><span className="legend-swatch cal-dot-invoice" /> 入金期日</span>
              <span className="legend-item"><span className="legend-swatch cal-dot-engagement" /> 契約終了</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{labelOf(selected)}{selected === today && " ・今日"}</h2>
            </div>
            {!day || (day.auto.length === 0 && day.tasks.length === 0) ? (
              <p className="small muted">この日の予定はありません。</p>
            ) : (
              <ul className="plan-list">
                {day.auto.map((a) => (
                  <li key={a.id}>
                    <span className={"legend-swatch cal-dot-" + a.source} />
                    <span className="num small muted plan-time">{a.time ?? "終日"}</span>
                    <Link href={a.path} className="plan-title">
                      {a.title}
                    </Link>
                    <span className="badge">{SOURCE_LABEL[a.source]}</span>
                  </li>
                ))}
                {day.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} showTime />
                ))}
              </ul>
            )}
            <form className="plan-add" onSubmit={addToDay}>
              <div className="chips" role="group" aria-label="種類">
                <button type="button" className="chip" aria-pressed={kind === "event"} onClick={() => setKind("event")} style={{ minHeight: 34 }}>
                  予定
                </button>
                <button type="button" className="chip" aria-pressed={kind === "todo"} onClick={() => setKind("todo")} style={{ minHeight: 34 }}>
                  ToDo
                </button>
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "event" ? "例：定例ミーティング" : "例：請求書を送る"} aria-label="タイトル" maxLength={100} />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="時刻（任意）" style={{ flex: "0 0 120px" }} />
              <button className="btn-primary" type="submit" disabled={!title.trim()}>
                <Plus size={16} /> 追加
              </button>
            </form>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>
              <ListTodo size={18} /> ToDo
            </h2>
            <span className="small muted">
              残り <strong className="num">{open.length}</strong> 件
            </span>
          </div>
          <form className="stack" style={{ gap: 8 }} onSubmit={addTodo}>
            <input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="やることを追加" aria-label="やること" maxLength={100} />
            <div className="inline">
              <input type="date" value={todoDate} onChange={(e) => setTodoDate(e.target.value)} aria-label="期限（任意）" style={{ flex: 1 }} />
              <button className="btn-primary btn-sm" type="submit" disabled={!todoTitle.trim()}>
                <Plus size={14} /> 追加
              </button>
            </div>
          </form>

          {!tasks && <div className="skeleton" style={{ height: 160, marginTop: 12 }} />}
          {tasks && open.length === 0 && <div className="empty-state" style={{ marginTop: 12 }}>やることはありません 🎉</div>}

          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.key} style={{ marginTop: 14 }}>
                <div className="small" style={{ fontWeight: 700, color: g.tone ?? "var(--ink-2)" }}>
                  {g.label}（{g.items.length}）
                </div>
                <ul className="plan-list">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} showDate={g.key !== "today" && g.key !== "nodate"} />
                  ))}
                </ul>
              </div>
            ))}

          {done.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button className="btn-link small" onClick={() => setShowDone((v) => !v)}>
                完了したもの（{done.length}）を{showDone ? "隠す" : "見る"}
              </button>
              {showDone && (
                <ul className="plan-list">
                  {done.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
