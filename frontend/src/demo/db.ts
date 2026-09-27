// デモ版（GitHub Pages）用のデータストア。
// backend の `npm run export:demo` で書き出した seed.json を読み込み、見ている人のブラウザ（localStorage）にだけ保存する。
import seedJson from "./seed.json";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  invoiceRegistrationNumber: string | null;
  workStyle: string;
  role: string;
  interests: string;
  signupSource: string | null;
  referredById?: string | null;
  birthYear: number | null;
  lastCheckupDate: string | null;
  joinedAt: string;
  createdAt: string;
}
export interface DemoProject {
  id: string;
  title: string;
  client: string;
  skills: string;
  unitPrice: number;
  workStyle: string;
  description: string;
  isListed?: boolean;
  createdAt: string;
}
export interface DemoEngagement {
  id: string;
  userId: string;
  projectId: string;
  monthlyRate: number;
  startDate: string;
  endDate: string | null;
  status: string;
  settlementMin: number;
  settlementMax: number;
  paymentTermDays: number;
}
export interface DemoInvoice {
  id: string;
  engagementId: string;
  targetMonth: string;
  amount: number;
  baseAmount: number;
  workHours: number | null;
  adjustment: number;
  withholding: number;
  dueDate: string | null;
  paidAt: string | null;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  registrationNumber: string;
  invoiceNumber: string;
  status: string;
  issuedAt: string;
}
export interface DemoContract {
  id: string;
  engagementId: string;
  title: string;
  body: string;
  status: string;
  signedAt: string | null;
  signedName: string | null;
  createdAt: string;
}
export interface DemoSkillSheet {
  id: string;
  userId: string;
  summary: string;
  skills: string;
  experiences: string;
  age: number | null;
  nearestStation: string | null;
  availability: string | null;
  desiredRate: number | null;
  totalExperienceYears: number | null;
  workProcesses: string | null;
  appealPoints: string | null;
  remarks: string | null;
  updatedAt: string;
}
export interface DemoEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  durationMin: number;
  location: string;
  isOnline: boolean;
  joinUrl: string | null;
  speaker: string | null;
  tags: string;
  description: string;
  capacity: number;
  clubId: string | null;
  createdAt: string;
}
export interface DemoApplication {
  id: string;
  userId: string;
  eventId: string;
  purpose: string | null;
  level: string | null;
  question: string | null;
  appliedAt: string;
}
export interface DemoClub {
  id: string;
  slug: string;
  name: string;
  catchphrase: string;
  description: string;
  schedule: string;
  place: string;
  level: string;
  photo: string;
  color: string;
  status?: string;
  sortOrder: number;
}
export interface DemoMembership {
  id: string;
  userId: string;
  clubId: string;
  joinedAt: string;
}
export interface DemoHealthLog {
  id: string;
  userId: string;
  date: string;
  steps: number | null;
  sleepHours: number | null;
  exerciseMin: number | null;
  mood: number | null;
  createdAt: string;
}
export interface DemoWealthPlan {
  id: string;
  userId: string;
  monthlyLivingCost: number;
  cashSavings: number;
  investedAssets: number;
  kyosaiMonthly: number;
  idecoMonthly: number;
  nisaMonthly: number;
  expectedReturn: number;
  retireAge: number;
  updatedAt: string;
}
export interface DemoRateDiagnosis {
  id: string;
  userId: string | null;
  primarySkill: string;
  role: string;
  yearsOfExperience: number;
  monthlyRate: number;
  chainDepth: number | null;
  createdAt: string;
}
export interface DemoExpense {
  id: string;
  userId: string;
  date: string;
  vendor: string;
  amount: number;
  category: string;
  memo: string | null;
  ocrRawText: string | null;
  createdAt: string;
}
export interface DemoMentorRequest {
  id: string;
  userId: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
}
export interface DemoMessage {
  id: string;
  userId: string;
  role: string;
  content: string;
  auto?: boolean; // 担当者チャットの受付自動応答
  createdAt: string;
}

export interface DemoTask {
  id: string;
  userId: string;
  title: string;
  kind: string;
  date: string | null;
  time: string | null;
  memo: string | null;
  doneAt: string | null;
  createdAt: string;
}

export interface DemoDB {
  users: DemoUser[];
  passwords: Record<string, string>; // デモで新規登録した人のパスワード（このブラウザ内だけ）
  projects: DemoProject[];
  engagements: DemoEngagement[];
  invoices: DemoInvoice[];
  contracts: DemoContract[];
  skillSheets: DemoSkillSheet[];
  events: DemoEvent[];
  eventApplications: DemoApplication[];
  clubs: DemoClub[];
  clubMemberships: DemoMembership[];
  healthLogs: DemoHealthLog[];
  wealthPlans: DemoWealthPlan[];
  rateDiagnoses: DemoRateDiagnosis[];
  expenses: DemoExpense[];
  mentorRequests: DemoMentorRequest[];
  fpMessages: DemoMessage[];
  chatMessages: DemoMessage[];
  tasks: DemoTask[];
}

const STORAGE_KEY = "sotoba_demo_db_v1";
const DAY = 86_400_000;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 書き出した日から今日までの日数だけ、すべての日付を後ろにずらす（いつ見ても「今日基準」のデモになる）
function shiftSeed(now: Date): DemoDB {
  const seed = seedJson as unknown as Omit<DemoDB, "passwords" | "fpMessages"> & { exportedAt: string };
  const days = Math.max(0, Math.floor((now.getTime() - new Date(seed.exportedAt).getTime()) / DAY));
  const months = Math.round(days / 30.44);

  const shiftValue = (key: string, v: unknown): unknown => {
    if (typeof v !== "string") return v;
    if (ISO_DATETIME.test(v)) return new Date(new Date(v).getTime() + days * DAY).toISOString();
    if (key === "date" && ISO_DATE.test(v)) {
      const [y, m, d] = v.split("-").map(Number);
      return ymd(new Date(y, m - 1, d + days));
    }
    if (key === "targetMonth" && /^\d{4}-\d{2}$/.test(v)) {
      const [y, m] = v.split("-").map(Number);
      const d = new Date(y, m - 1 + months, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return v;
  };
  const shiftRows = <T,>(rows: T[]): T[] =>
    rows.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, shiftValue(k, v)])) as T);

  const tables = Object.entries(seed).filter(([k]) => k !== "exportedAt");
  const shifted = Object.fromEntries(tables.map(([k, rows]) => [k, shiftRows(rows as unknown[])])) as Omit<DemoDB, "passwords" | "fpMessages">;
  return { ...shifted, passwords: {}, fpMessages: [] };
}

let memory: DemoDB | null = null;

function canUseStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getDB(): DemoDB {
  if (memory) return memory;
  if (canUseStorage()) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        memory = JSON.parse(saved) as DemoDB;
        memory.tasks ??= []; // カレンダー・ToDo 追加前に保存されたデータ
        return memory;
      }
    } catch {
      // 壊れていたら初期データから作り直す
    }
  }
  memory = shiftSeed(new Date());
  return memory;
}

// ビルド時（サーバー）に公開ページを描画するための、保存しない新品のデータ
export function freshDB(): DemoDB {
  return shiftSeed(new Date());
}

export function saveDB() {
  if (!memory || !canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // 容量オーバーなどは無視（デモなので保存できなくても動作は続ける）
  }
}

export function resetDB() {
  memory = null;
  if (canUseStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 何もしない
    }
  }
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
