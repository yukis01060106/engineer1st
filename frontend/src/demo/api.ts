// デモ版（GitHub Pages）の「ブラウザの中のバックエンド」。
// backend/src/routes と同じ形のレスポンスを返す。計算ロジックは backend/src/lib をそのまま共有している（@shared）。
import {
  calcTax,
  calcSettlement,
  calcWithholding,
  calcDueDate,
  invoiceState,
  nextInvoiceNumber,
  paymentReminderText,
  FREELANCE_ACT_MAX_DAYS,
} from "@shared/invoice";
import { calcTaxReserve } from "@shared/taxReserve";
import { simulateReward, simulateSalary } from "@shared/rewardSimulator";
import { calcRank, calcTenureYears, unlockedBenefits, RANK_BENEFITS, formatMemberNumber } from "@shared/rank";
import { scoreProjectsBySkills } from "@shared/recommend";
import { generateSummary } from "@shared/skillSummary";
import { diagnoseRate, EXPERIENCE_BAND } from "@shared/rateDiagnosis";
import { computeSnapshot } from "@shared/fpSnapshot";
import { ruleBasedAnswer } from "@shared/fpRules";
import { buildAlerts, EVENT_REMINDER_DAYS, CHECKUP_INTERVAL_DAYS } from "@shared/alerts";
import { scoreLead } from "@shared/leadScore";
import { buildOnboarding } from "@shared/onboarding";
import { computeSkillGaps } from "@shared/skillGap";
import { autoReply, CHAT_WELCOME } from "@shared/chatReply";
import { buildAutoItems } from "@shared/planner";
import { buildExpenseCsv } from "@shared/expenseCsv";
import { getDB, freshDB, saveDB, newId, DemoDB, DemoUser, DemoEvent, DemoInvoice, DemoTask } from "./db";

export const DEMO_PASSWORD = "password123";
const DAY = 86_400_000;

export interface DemoResponse {
  status: number;
  data: unknown;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Body = Record<string, unknown>;
interface Ctx {
  db: DemoDB;
  method: string;
  path: string;
  query: URLSearchParams;
  body: Body;
  user: DemoUser | null;
  params: string[];
}

const d = (s: string | null | undefined) => (s ? new Date(s) : null);
const nowIso = () => new Date().toISOString();

function requireUser(c: Ctx): DemoUser {
  if (!c.user) throw new HttpError(401, "認証が必要です");
  return c.user;
}

function publicUser(u: DemoUser) {
  return { id: u.id, email: u.email, name: u.name, workStyle: u.workStyle, role: u.role, interests: JSON.parse(u.interests) as string[] };
}

// 案件一覧に出す案件（本人が自分で登録した取引は出さない）
const listed = (db: DemoDB) => db.projects.filter((p) => p.isListed !== false);

function projectOf(db: DemoDB, projectId: string) {
  return db.projects.find((p) => p.id === projectId)!;
}

function engagementsOf(db: DemoDB, userId: string) {
  return db.engagements
    .filter((e) => e.userId === userId)
    .map((e) => ({ ...e, project: projectOf(db, e.projectId) }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function invoicesOf(db: DemoDB, userId: string) {
  const engIds = new Set(db.engagements.filter((e) => e.userId === userId).map((e) => e.id));
  return db.invoices.filter((i) => engIds.has(i.engagementId));
}

function withEngagement(db: DemoDB, inv: DemoInvoice) {
  const e = db.engagements.find((x) => x.id === inv.engagementId)!;
  return { ...inv, engagement: { ...e, project: projectOf(db, e.projectId) } };
}

function invoiceDates(inv: DemoInvoice) {
  return { paidAt: d(inv.paidAt), dueDate: d(inv.dueDate) };
}

function publicEvent(db: DemoDB, e: DemoEvent, userId: string | null) {
  const { joinUrl, ...rest } = e;
  const club = e.clubId ? db.clubs.find((c) => c.id === e.clubId) : null;
  const apps = db.eventApplications.filter((a) => a.eventId === e.id);
  return {
    ...rest,
    hasJoinUrl: !!joinUrl,
    club: club ? { slug: club.slug, name: club.name, color: club.color } : null,
    _count: { applications: apps.length },
    applied: userId ? apps.some((a) => a.userId === userId) : false,
  };
}

function snapshotFor(db: DemoDB, user: DemoUser) {
  const plan = db.wealthPlans.find((p) => p.userId === user.id) ?? null;
  return computeSnapshot({
    user: { ...user },
    engagements: engagementsOf(db, user.id).map((e) => ({ ...e, endDate: d(e.endDate) })),
    invoices: invoicesOf(db, user.id).map((i) => ({ totalAmount: i.totalAmount, ...invoiceDates(i) })),
    plan,
  });
}

function buildInvoice(
  eng: { monthlyRate: number; settlementMin: number; settlementMax: number; paymentTermDays: number },
  input: { targetMonth: string; workHours?: number | null; applyWithholding?: boolean }
) {
  const settlement = calcSettlement({
    monthlyRate: eng.monthlyRate,
    workHours: input.workHours ?? null,
    settlementMin: eng.settlementMin,
    settlementMax: eng.settlementMax,
  });
  const tax = calcTax(settlement.amount, 10);
  const withholding = input.applyWithholding ? calcWithholding(settlement.amount) : 0;
  return {
    ...tax,
    baseAmount: settlement.baseAmount,
    adjustment: settlement.adjustment,
    settlementNote: settlement.note,
    withholding,
    transferAmount: tax.totalAmount - withholding,
    dueDate: calcDueDate(input.targetMonth, eng.paymentTermDays),
  };
}

function ownEngagement(c: Ctx, id: string) {
  const user = requireUser(c);
  const e = c.db.engagements.find((x) => x.id === id);
  if (!e || e.userId !== user.id) throw new HttpError(404, "稼働情報が見つかりません");
  return e;
}

function ownInvoice(c: Ctx, id: string) {
  const user = requireUser(c);
  const inv = c.db.invoices.find((x) => x.id === id);
  const e = inv && c.db.engagements.find((x) => x.id === inv.engagementId);
  if (!inv || !e || e.userId !== user.id) throw new HttpError(404, "請求書が見つかりません");
  return inv;
}

function requireAdmin(c: Ctx) {
  const u = requireUser(c);
  if (u.role !== "admin") throw new HttpError(403, "運営アカウントのみ利用できます");
  return u;
}

type Handler = (c: Ctx) => unknown;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp("^" + pattern.replace(/:[a-zA-Z]+/g, "([^/]+)") + "$"), h]);

// ---------- 認証 ----------
on("POST", "/auth/register", (c) => {
  const b = c.body as { email: string; password: string; name: string; workStyle?: string; interests?: string[]; clubSlug?: string; eventId?: string; referrerId?: string };
  if (!b.email || !b.password || b.password.length < 8 || !b.name) throw new HttpError(400, "入力内容を確認してください");
  if (c.db.users.some((u) => u.email === b.email)) throw new HttpError(409, "このメールアドレスは既に登録されています");
  const sourceClub = b.clubSlug ? c.db.clubs.find((x) => x.slug === b.clubSlug) : undefined;
  const club = sourceClub && (sourceClub.status ?? "open") === "open" ? sourceClub : undefined; // 準備中の部には入部させない
  const referrer = b.referrerId ? c.db.users.find((u) => u.id === b.referrerId) : undefined;
  const user: DemoUser = {
    id: newId("user"),
    email: b.email,
    name: b.name,
    invoiceRegistrationNumber: null,
    workStyle: b.workStyle ?? "freelance",
    role: "member",
    interests: JSON.stringify(b.interests ?? []),
    signupSource: referrer ? "referral" : sourceClub ? `club:${sourceClub.slug}` : b.eventId ? "event" : null,
    referredById: referrer?.id ?? null,
    birthYear: null,
    lastCheckupDate: null,
    joinedAt: nowIso(),
    createdAt: nowIso(),
  };
  c.db.users.push(user);
  c.db.passwords[user.email] = b.password;
  if (club) c.db.clubMemberships.push({ id: newId("m"), userId: user.id, clubId: club.id, joinedAt: nowIso() });
  return { status: 201, data: { token: `demo:${user.id}`, user: publicUser(user), joinedClub: club?.name ?? null } };
});

on("POST", "/auth/login", (c) => {
  const b = c.body as { email: string; password: string };
  const user = c.db.users.find((u) => u.email === b.email);
  const expected = user ? c.db.passwords[user.email] ?? DEMO_PASSWORD : null;
  if (!user || b.password !== expected) throw new HttpError(401, "メールアドレスまたはパスワードが違います");
  return { token: `demo:${user.id}`, user: publicUser(user) };
});

// ---------- マイページ ----------
on("POST", "/auth/password", (c) => {
  const user = requireUser(c);
  const b = c.body as { currentPassword: string; newPassword: string };
  if (!b.newPassword || b.newPassword.length < 8) throw new HttpError(400, "新しいパスワードは8文字以上にしてください");
  if (b.currentPassword !== (c.db.passwords[user.email] ?? DEMO_PASSWORD)) throw new HttpError(401, "いまのパスワードが違います");
  c.db.passwords[user.email] = b.newPassword;
  return { ok: true };
});
on("DELETE", "/auth/me", (c) => {
  const user = requireUser(c);
  const b = c.body as { password: string };
  if (user.role === "admin") throw new HttpError(400, "運営アカウントは画面から退会できません");
  if (b.password !== (c.db.passwords[user.email] ?? DEMO_PASSWORD)) throw new HttpError(401, "パスワードが違います");
  const id = user.id;
  const engIds = new Set(c.db.engagements.filter((e) => e.userId === id).map((e) => e.id));
  const db = c.db;
  db.invoices = db.invoices.filter((x) => !engIds.has(x.engagementId));
  db.contracts = db.contracts.filter((x) => !engIds.has(x.engagementId));
  db.engagements = db.engagements.filter((x) => x.userId !== id);
  db.projects = db.projects.filter((p) => p.isListed !== false || db.engagements.some((e) => e.projectId === p.id));
  db.skillSheets = db.skillSheets.filter((x) => x.userId !== id);
  db.eventApplications = db.eventApplications.filter((x) => x.userId !== id);
  db.mentorRequests = db.mentorRequests.filter((x) => x.userId !== id);
  db.rateDiagnoses.forEach((x) => { if (x.userId === id) x.userId = null; });
  db.expenses = db.expenses.filter((x) => x.userId !== id);
  db.clubMemberships = db.clubMemberships.filter((x) => x.userId !== id);
  db.healthLogs = db.healthLogs.filter((x) => x.userId !== id);
  db.wealthPlans = db.wealthPlans.filter((x) => x.userId !== id);
  db.fpMessages = db.fpMessages.filter((x) => x.userId !== id);
  db.chatMessages = db.chatMessages.filter((x) => x.userId !== id);
  db.tasks = db.tasks.filter((x) => x.userId !== id);
  db.users.forEach((u) => { if (u.referredById === id) u.referredById = null; });
  db.users = db.users.filter((u) => u.id !== id);
  delete db.passwords[user.email];
  return { status: 204, data: {} };
});
on("GET", "/mypage", (c) => {
  const user = requireUser(c);
  const { db } = c;
  const now = new Date();
  const engagements = engagementsOf(db, user.id);
  const current = engagements.find((e) => e.status === "稼働中") ?? null;
  const sheet = db.skillSheets.find((s) => s.userId === user.id) ?? null;
  const rank = calcRank(new Date(user.joinedAt), now);
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const skillNames = sheet ? (JSON.parse(sheet.skills) as { name: string }[]).map((s) => s.name) : [];
  const soon = db.events
    .filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= now.getTime() && t <= now.getTime() + EVENT_REMINDER_DAYS * DAY && !db.eventApplications.some((a) => a.eventId === e.id && a.userId === user.id);
    })
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const alerts = buildAlerts({
    now,
    workStyle: user.workStyle,
    hasSkillSheet: !!sheet,
    lastCheckupDate: d(user.lastCheckupDate),
    currentEngagement: current ? { ...current, endDate: d(current.endDate) } : null,
    recommendedProjects: scoreProjectsBySkills(listed(db), skillNames).slice(0, 3),
    unpaidInvoices: invoicesOf(db, user.id)
      .filter((i) => !i.paidAt)
      .map((i) => ({ targetMonth: i.targetMonth, ...invoiceDates(i), client: withEngagement(db, i).engagement.project.client })),
    currentMonthInvoiceIssued: !!current && db.invoices.some((i) => i.engagementId === current.id && i.targetMonth === ym),
    unsignedContractCount: db.contracts.filter((ct) => ct.status === "未締結" && engagements.some((e) => e.id === ct.engagementId)).length,
    soonUnappliedEvent: soon ?? null,
    staffReplied: (() => {
      const last = db.chatMessages.filter((m) => m.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return !!last && last.role === "staff" && !last.auto;
    })(),
  });

  const upcoming = db.eventApplications
    .filter((a) => a.userId === user.id)
    .map((a) => db.events.find((e) => e.id === a.eventId)!)
    .filter((e) => e && new Date(e.date).getTime() >= now.getTime() - 3 * 3600_000)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)
    .map((e) => {
      const club = e.clubId ? db.clubs.find((x) => x.id === e.clubId) : null;
      return { id: e.id, title: e.title, type: e.type, date: e.date, location: e.location, isOnline: e.isOnline, joinUrl: e.joinUrl, club: club ? { name: club.name, slug: club.slug } : null };
    });

  const onboarding = buildOnboarding({
    workStyle: user.workStyle,
    clubCount: db.clubMemberships.filter((m) => m.userId === user.id).length,
    eventCount: db.eventApplications.filter((a) => a.userId === user.id).length,
    healthLogCount: db.healthLogs.filter((l) => l.userId === user.id).length,
    hasWealthPlan: db.wealthPlans.some((p) => p.userId === user.id),
    hasSkillSheet: !!sheet,
    engagementCount: engagements.length,
    hasInvoiceNumber: !!user.invoiceRegistrationNumber,
  });

  return {
    onboarding,
    referralCount: db.users.filter((u) => u.referredById === user.id).length,
    user: { ...publicUser(user), joinedAt: user.joinedAt, invoiceRegistrationNumber: user.invoiceRegistrationNumber, memberNumber: formatMemberNumber(user.id) },
    rank: {
      current: rank,
      tenureYears: Math.round(calcTenureYears(new Date(user.joinedAt), now) * 10) / 10,
      unlockedBenefits: unlockedBenefits(rank),
      allRanks: RANK_BENEFITS,
    },
    currentEngagement: current,
    hasSkillSheet: !!sheet,
    engagementHistory: engagements,
    alerts,
    clubs: db.clubMemberships
      .filter((m) => m.userId === user.id)
      .map((m) => db.clubs.find((x) => x.id === m.clubId)!)
      .map((x) => ({ slug: x.slug, name: x.name, color: x.color, photo: x.photo })),
    upcomingEvents: upcoming,
  };
});

on("PATCH", "/mypage", (c) => {
  const user = requireUser(c);
  const b = c.body as { name?: string; workStyle?: string; invoiceRegistrationNumber?: string | null };
  if (b.name !== undefined) user.name = b.name;
  if (b.workStyle !== undefined) user.workStyle = b.workStyle;
  if (b.invoiceRegistrationNumber !== undefined) user.invoiceRegistrationNumber = b.invoiceRegistrationNumber;
  return { user: { ...publicUser(user), invoiceRegistrationNumber: user.invoiceRegistrationNumber } };
});

// ---------- 案件 ----------
on("GET", "/projects", (c) => {
  const keyword = c.query.get("keyword");
  const minPrice = Number(c.query.get("minPrice")) || 0;
  const projects = listed(c.db)
    .filter((p) => !keyword || [p.title, p.skills, p.client].some((f) => f.includes(keyword)))
    .filter((p) => p.unitPrice >= minPrice)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { projects };
});
on("GET", "/projects/recommend/for-me", (c) => {
  const user = requireUser(c);
  const sheet = c.db.skillSheets.find((s) => s.userId === user.id);
  const names = sheet ? (JSON.parse(sheet.skills) as { name: string }[]).map((s) => s.name) : [];
  return { recommendations: scoreProjectsBySkills(listed(c.db), names).slice(0, 10) };
});

// ---------- スキルシート ----------
function parseSheet(s: { skills: string; experiences: string; workProcesses: string | null; appealPoints: string | null }) {
  return {
    skills: JSON.parse(s.skills),
    experiences: JSON.parse(s.experiences),
    workProcesses: s.workProcesses ? JSON.parse(s.workProcesses) : [],
    appealPoints: s.appealPoints ? JSON.parse(s.appealPoints) : [],
  };
}
on("GET", "/skill-sheet", (c) => {
  const user = requireUser(c);
  const sheet = c.db.skillSheets.find((s) => s.userId === user.id);
  return { skillSheet: sheet ? { ...sheet, ...parseSheet(sheet) } : null };
});
on("GET", "/skill-sheet/defaults", (c) => {
  const user = requireUser(c);
  const current = c.db.engagements.find((e) => e.userId === user.id && e.status === "稼働中");
  const sheet = c.db.skillSheets.find((s) => s.userId === user.id);
  const skills = sheet ? (JSON.parse(sheet.skills) as { years: number }[]) : [];
  return {
    defaults: {
      desiredRate: current?.monthlyRate ?? null,
      availability: current?.endDate ? `${current.endDate.slice(0, 10)}以降（応相談）` : "即日",
      totalExperienceYears: skills.length ? Math.max(...skills.map((s) => s.years)) : null,
    },
  };
});
on("POST", "/skill-sheet", (c) => {
  const user = requireUser(c);
  const b = c.body as {
    skills: { name: string; level: number; years: number }[];
    experiences: { title: string; period: string; role: string; tech: string; description: string }[];
    age?: number | null;
    nearestStation?: string | null;
    availability?: string | null;
    desiredRate?: number | null;
    totalExperienceYears?: number | null;
    workProcesses?: string[];
    appealPoints?: string[];
    remarks?: string | null;
  };
  const workProcesses = b.workProcesses ?? [];
  const appealPoints = b.appealPoints ?? [];
  const totalExperienceYears = b.totalExperienceYears ?? (b.skills.length ? Math.max(...b.skills.map((s) => s.years)) : null);
  const summary = generateSummary({ ...b, name: user.name, totalExperienceYears, workProcesses, appealPoints });
  const data = {
    skills: JSON.stringify(b.skills),
    experiences: JSON.stringify(b.experiences),
    age: b.age ?? null,
    nearestStation: b.nearestStation ?? null,
    availability: b.availability ?? null,
    desiredRate: b.desiredRate ?? null,
    totalExperienceYears,
    workProcesses: JSON.stringify(workProcesses),
    appealPoints: JSON.stringify(appealPoints),
    remarks: b.remarks ?? null,
    summary,
    updatedAt: nowIso(),
  };
  const existing = c.db.skillSheets.find((s) => s.userId === user.id);
  const sheet = existing ? Object.assign(existing, data) : { id: newId("sheet"), userId: user.id, ...data };
  if (!existing) c.db.skillSheets.push(sheet);
  return { skillSheet: { ...sheet, skills: b.skills, experiences: b.experiences, workProcesses, appealPoints } };
});

// ---------- シミュレーション・診断 ----------
on("POST", "/reward-sim", (c) => {
  const b = c.body as { monthlyRate: number; workingMonths?: number; expenseRatio?: number; isBlueTaxReturn?: boolean; currentSalary?: number };
  const input = { monthlyRate: b.monthlyRate, workingMonths: b.workingMonths ?? 12, expenseRatio: b.expenseRatio ?? 0.2, isBlueTaxReturn: b.isBlueTaxReturn ?? true };
  return { input, result: simulateReward(input), salary: b.currentSalary ? simulateSalary(b.currentSalary) : null };
});
on("POST", "/rate-diagnosis", (c) => {
  const b = c.body as { primarySkill: string; role: string; yearsOfExperience: number; monthlyRate: number; chainDepth?: number };
  const similar = c.db.rateDiagnoses
    .filter((r) => r.role === b.role && r.primarySkill === b.primarySkill && Math.abs(r.yearsOfExperience - b.yearsOfExperience) <= EXPERIENCE_BAND)
    .map((r) => r.monthlyRate);
  const result = diagnoseRate(b, similar);
  c.db.rateDiagnoses.push({ id: newId("rate"), userId: c.user?.id ?? null, ...b, chainDepth: b.chainDepth ?? null, createdAt: nowIso() });
  return { status: 201, data: { result } };
});
on("GET", "/rate-diagnosis/mine", (c) => {
  const user = requireUser(c);
  return { diagnoses: c.db.rateDiagnoses.filter((r) => r.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
});
on("GET", "/skill-gap", (c) => {
  const user = requireUser(c);
  const sheet = c.db.skillSheets.find((s) => s.userId === user.id);
  return { gaps: computeSkillGaps(sheet ? JSON.parse(sheet.skills) : []), hasSkillSheet: !!sheet };
});

// ---------- 請求・入金・税金 ----------
on("GET", "/money/engagements", (c) => {
  const user = requireUser(c);
  return { engagements: engagementsOf(c.db, user.id).map((e) => ({ ...e, paymentTermWarning: e.paymentTermDays > FREELANCE_ACT_MAX_DAYS })) };
});
on("POST", "/money/engagements", (c) => {
  const user = requireUser(c);
  const b = c.body as {
    client: string;
    title: string;
    monthlyRate: number;
    startDate: string;
    endDate?: string | null;
    settlementMin?: number;
    settlementMax?: number;
    paymentTermDays?: number;
  };
  if (!b.client || !b.title || !b.monthlyRate || !b.startDate) throw new HttpError(400, "入力内容を確認してください");
  const settlementMin = b.settlementMin ?? 140;
  const settlementMax = b.settlementMax ?? 180;
  if (settlementMin > settlementMax) throw new HttpError(400, "精算幅は「下限 ≦ 上限」で入力してください");
  const project = { id: newId("proj"), title: b.title, client: b.client, skills: "", unitPrice: b.monthlyRate, workStyle: "", description: "本人が登録した取引", isListed: false, createdAt: nowIso() };
  c.db.projects.push(project);
  const engagement = {
    id: newId("eng"),
    userId: user.id,
    projectId: project.id,
    monthlyRate: b.monthlyRate,
    startDate: new Date(b.startDate).toISOString(),
    endDate: b.endDate ? new Date(b.endDate).toISOString() : null,
    status: "稼働中",
    settlementMin,
    settlementMax,
    paymentTermDays: b.paymentTermDays ?? 30,
  };
  c.db.engagements.push(engagement);
  return { status: 201, data: { engagement: { ...engagement, project } } };
});
on("PATCH", "/money/engagements/:id", (c) => {
  const e = ownEngagement(c, c.params[0]);
  const b = c.body as { settlementMin: number; settlementMax: number; paymentTermDays: number; monthlyRate?: number; endDate?: string | null; status?: string };
  if (b.settlementMin > b.settlementMax) throw new HttpError(400, "精算幅は「下限 ≦ 上限」で入力してください");
  const { endDate, ...rest } = b;
  Object.assign(e, rest);
  if (endDate !== undefined) e.endDate = endDate ? new Date(endDate).toISOString() : null;
  return { engagement: e };
});
on("GET", "/money/invoices", (c) => {
  const user = requireUser(c);
  const now = new Date();
  const list = invoicesOf(c.db, user.id)
    .map((i) => ({ ...withEngagement(c.db, i), state: invoiceState(invoiceDates(i), now) }))
    .sort((a, b) => b.targetMonth.localeCompare(a.targetMonth) || b.issuedAt.localeCompare(a.issuedAt));
  const outstanding = list.filter((i) => i.state !== "paid");
  return {
    invoices: list,
    summary: {
      outstandingAmount: outstanding.reduce((s, i) => s + i.totalAmount - i.withholding, 0),
      overdueCount: list.filter((i) => i.state === "overdue").length,
      paidThisYear: list.filter((i) => i.paidAt && new Date(i.paidAt).getFullYear() === now.getFullYear()).reduce((s, i) => s + i.amount, 0),
    },
  };
});
on("POST", "/money/invoices/preview", (c) => {
  const b = c.body as { engagementId: string; targetMonth: string; workHours?: number | null; applyWithholding?: boolean };
  return { preview: buildInvoice(ownEngagement(c, b.engagementId), b) };
});
on("POST", "/money/invoices", (c) => {
  const user = requireUser(c);
  const b = c.body as { engagementId: string; targetMonth: string; workHours?: number | null; applyWithholding?: boolean };
  const e = ownEngagement(c, b.engagementId);
  const dup = c.db.invoices.find((i) => i.engagementId === e.id && i.targetMonth === b.targetMonth);
  if (dup) throw new HttpError(409, `${b.targetMonth}分の請求書はすでに発行済みです（${dup.invoiceNumber}）`);
  const x = buildInvoice(e, b);
  const invoice: DemoInvoice = {
    id: newId("inv"),
    engagementId: e.id,
    targetMonth: b.targetMonth,
    amount: x.amount,
    baseAmount: x.baseAmount,
    workHours: b.workHours ?? null,
    adjustment: x.adjustment,
    withholding: x.withholding,
    dueDate: x.dueDate.toISOString(),
    paidAt: null,
    taxRate: x.taxRate,
    taxAmount: x.taxAmount,
    totalAmount: x.totalAmount,
    registrationNumber: user.invoiceRegistrationNumber ?? "未登録（設定画面で登録番号を入力してください）",
    invoiceNumber: nextInvoiceNumber(b.targetMonth),
    status: "発行済み",
    issuedAt: nowIso(),
  };
  c.db.invoices.push(invoice);
  return { status: 201, data: { invoice } };
});
on("POST", "/money/invoices/:id/paid", (c) => {
  const inv = ownInvoice(c, c.params[0]);
  const paid = (c.body as { paid: boolean }).paid;
  inv.paidAt = paid ? nowIso() : null;
  inv.status = paid ? "入金済み" : "発行済み";
  return { invoice: inv };
});
on("GET", "/money/invoices/:id/reminder", (c) => {
  const inv = ownInvoice(c, c.params[0]);
  const full = withEngagement(c.db, inv);
  return {
    text: paymentReminderText({
      clientName: full.engagement.project.client,
      userName: c.user!.name,
      invoiceNumber: inv.invoiceNumber,
      targetMonth: inv.targetMonth,
      totalAmount: inv.totalAmount - inv.withholding,
      dueDate: d(inv.dueDate) ?? new Date(),
    }),
  };
});
on("GET", "/money/tax-reserve", (c) => {
  const user = requireUser(c);
  const q = c.query;
  const current = c.db.engagements.find((e) => e.userId === user.id && e.status === "稼働中");
  const monthlyRate = Number(q.get("monthlyRate")) || current?.monthlyRate || 600_000;
  const result = calcTaxReserve({
    monthlyRate,
    workingMonths: Math.min(12, Math.max(1, Number(q.get("workingMonths")) || 12)),
    expenseRatio: q.get("expenseRatio") != null ? Math.min(0.9, Math.max(0, Number(q.get("expenseRatio")))) : 0.2,
    isBlueTaxReturn: q.get("blue") !== "false",
    invoiceRegistered: q.get("invoice") != null ? q.get("invoice") === "true" : !!user.invoiceRegistrationNumber,
    year: new Date().getFullYear(),
  });
  return { monthlyRate, result };
});

// ---------- 部活 ----------
function clubSummary(db: DemoDB, userId: string | null) {
  const now = Date.now();
  return [...db.clubs]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((club) => {
      const next = db.events.filter((e) => e.clubId === club.id && new Date(e.date).getTime() >= now).sort((a, b) => a.date.localeCompare(b.date))[0];
      return {
        ...club,
        memberCount: db.clubMemberships.filter((m) => m.clubId === club.id).length,
        nextActivity: next ? { id: next.id, title: next.title, date: next.date, location: next.location } : null,
        joined: !!userId && db.clubMemberships.some((m) => m.clubId === club.id && m.userId === userId),
      };
    });
}
on("GET", "/clubs", (c) => ({ clubs: clubSummary(c.db, c.user?.id ?? null) }));
on("GET", "/clubs/:slug", (c) => {
  const club = c.db.clubs.find((x) => x.slug === decodeURIComponent(c.params[0]));
  if (!club) throw new HttpError(404, "部活が見つかりません");
  const now = Date.now();
  return {
    club: {
      ...club,
      events: c.db.events.filter((e) => e.clubId === club.id && new Date(e.date).getTime() >= now).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
      memberCount: c.db.clubMemberships.filter((m) => m.clubId === club.id).length,
      joined: !!c.user && c.db.clubMemberships.some((m) => m.clubId === club.id && m.userId === c.user!.id),
    },
  };
});
on("POST", "/clubs/:slug/join", (c) => {
  const user = requireUser(c);
  const club = c.db.clubs.find((x) => x.slug === c.params[0]);
  if (!club) throw new HttpError(404, "部活が見つかりません");
  if ((club.status ?? "open") !== "open") throw new HttpError(409, "この部活は準備中です。始まるまでお待ちください");
  if (!c.db.clubMemberships.some((m) => m.clubId === club.id && m.userId === user.id)) {
    c.db.clubMemberships.push({ id: newId("m"), userId: user.id, clubId: club.id, joinedAt: nowIso() });
  }
  return { status: 201, data: { joined: true } };
});
on("DELETE", "/clubs/:slug/join", (c) => {
  const user = requireUser(c);
  const club = c.db.clubs.find((x) => x.slug === c.params[0]);
  if (!club) throw new HttpError(404, "部活が見つかりません");
  c.db.clubMemberships = c.db.clubMemberships.filter((m) => !(m.clubId === club.id && m.userId === user.id));
  return { joined: false };
});

// ---------- 勉強会・イベント ----------
on("GET", "/events", (c) => {
  const type = c.query.get("type");
  const since = Date.now() - DAY;
  return {
    events: c.db.events
      .filter((e) => new Date(e.date).getTime() >= since && (!type || e.type === type))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => publicEvent(c.db, e, c.user?.id ?? null)),
  };
});
on("GET", "/events/my-applications", (c) => {
  const user = requireUser(c);
  return {
    applications: c.db.eventApplications
      .filter((a) => a.userId === user.id)
      .map((a) => {
        const e = c.db.events.find((x) => x.id === a.eventId)!;
        const club = e.clubId ? c.db.clubs.find((x) => x.id === e.clubId) : null;
        return { ...a, event: { ...e, club: club ? { name: club.name, slug: club.slug } : null } };
      })
      .sort((a, b) => a.event.date.localeCompare(b.event.date)),
  };
});
on("GET", "/events/:id", (c) => {
  const e = c.db.events.find((x) => x.id === c.params[0]);
  if (!e) throw new HttpError(404, "イベントが見つかりません");
  const app = c.user ? c.db.eventApplications.find((a) => a.eventId === e.id && a.userId === c.user!.id) : null;
  return { event: publicEvent(c.db, e, c.user?.id ?? null), application: app ? { ...app, joinUrl: e.joinUrl } : null };
});
on("POST", "/events/:id/apply", (c) => {
  const user = requireUser(c);
  const e = c.db.events.find((x) => x.id === c.params[0]);
  if (!e) throw new HttpError(404, "イベントが見つかりません");
  const evClub = e.clubId ? c.db.clubs.find((x) => x.id === e.clubId) : undefined;
  if (evClub && (evClub.status ?? "open") !== "open") throw new HttpError(409, "この部活は準備中です");
  const apps = c.db.eventApplications.filter((a) => a.eventId === e.id);
  if (apps.length >= e.capacity) throw new HttpError(409, "定員に達しました");
  if (apps.some((a) => a.userId === user.id)) throw new HttpError(409, "既に申込済みです");
  if (e.clubId && !c.db.clubMemberships.some((m) => m.clubId === e.clubId && m.userId === user.id)) {
    c.db.clubMemberships.push({ id: newId("m"), userId: user.id, clubId: e.clubId, joinedAt: nowIso() });
  }
  const b = c.body as { purpose?: string; level?: string; question?: string };
  const app = { id: newId("app"), userId: user.id, eventId: e.id, purpose: b.purpose ?? null, level: b.level ?? null, question: b.question ?? null, appliedAt: nowIso() };
  c.db.eventApplications.push(app);
  return { status: 201, data: { application: { ...app, joinUrl: e.joinUrl } } };
});
on("DELETE", "/events/:id/apply", (c) => {
  const user = requireUser(c);
  c.db.eventApplications = c.db.eventApplications.filter((a) => !(a.eventId === c.params[0] && a.userId === user.id));
  return { ok: true };
});
on("POST", "/events", (c) => {
  requireAdmin(c);
  const b = c.body as Omit<DemoEvent, "id" | "createdAt">;
  if (!b.title || !b.date || !b.description) throw new HttpError(400, "入力内容を確認してください");
  const event: DemoEvent = {
    ...b,
    id: newId("event"),
    date: new Date(b.date).toISOString(),
    joinUrl: b.joinUrl || null,
    speaker: b.speaker || null,
    clubId: b.clubId || null,
    tags: b.tags ?? "",
    createdAt: nowIso(),
  };
  c.db.events.push(event);
  return { status: 201, data: { event } };
});
on("GET", "/events/:id/applications", (c) => {
  requireAdmin(c);
  return {
    applications: c.db.eventApplications
      .filter((a) => a.eventId === c.params[0])
      .map((a) => {
        const u = c.db.users.find((x) => x.id === a.userId)!;
        return { ...a, user: { name: u.name, email: u.email, workStyle: u.workStyle } };
      }),
  };
});

// ---------- 健康 ----------
function ymd(dt: Date) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
on("GET", "/health", (c) => {
  const user = requireUser(c);
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const days = Array.from({ length: 14 }, (_, i) => {
    const x = new Date(since);
    x.setDate(since.getDate() + i);
    return ymd(x);
  });
  const logs = new Map(c.db.healthLogs.filter((l) => l.userId === user.id).map((l) => [l.date, l]));
  const series = days.map((date) => {
    const l = logs.get(date);
    return { date, steps: l?.steps ?? null, sleepHours: l?.sleepHours ?? null, exerciseMin: l?.exerciseMin ?? null, mood: l?.mood ?? null };
  });
  const last7 = series.slice(-7);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
  };
  const last = d(user.lastCheckupDate);
  const daysSince = last ? Math.floor((Date.now() - last.getTime()) / DAY) : null;
  return {
    today: ymd(new Date()),
    series,
    weekly: {
      steps: avg(last7.map((x) => x.steps)),
      sleepHours: avg(last7.map((x) => x.sleepHours)),
      exerciseMin: last7.reduce((s, x) => s + (x.exerciseMin ?? 0), 0),
      mood: avg(last7.map((x) => x.mood)),
      loggedDays: last7.filter((x) => x.steps != null || x.sleepHours != null || x.mood != null).length,
    },
    checkup: { lastDate: user.lastCheckupDate, daysSince, due: daysSince == null || daysSince >= CHECKUP_INTERVAL_DAYS },
    clubs: c.db.clubMemberships
      .filter((m) => m.userId === user.id)
      .map((m) => c.db.clubs.find((x) => x.id === m.clubId)!)
      .map((x) => ({ slug: x.slug, name: x.name, color: x.color })),
  };
});
on("PUT", "/health/logs", (c) => {
  const user = requireUser(c);
  const b = c.body as { date: string; steps?: number | null; sleepHours?: number | null; exerciseMin?: number | null; mood?: number | null };
  const existing = c.db.healthLogs.find((l) => l.userId === user.id && l.date === b.date);
  const data = { steps: b.steps ?? null, sleepHours: b.sleepHours ?? null, exerciseMin: b.exerciseMin ?? null, mood: b.mood ?? null };
  if (existing) Object.assign(existing, data);
  else c.db.healthLogs.push({ id: newId("h"), userId: user.id, date: b.date, ...data, createdAt: nowIso() });
  return { ok: true };
});
on("PUT", "/health/checkup", (c) => {
  const user = requireUser(c);
  user.lastCheckupDate = new Date((c.body as { lastCheckupDate: string }).lastCheckupDate).toISOString();
  return { ok: true };
});

// ---------- 資産形成・AI FP ----------
on("GET", "/wealth", (c) => {
  const user = requireUser(c);
  return { snapshot: snapshotFor(c.db, user), birthYear: user.birthYear };
});
on("PUT", "/wealth/plan", (c) => {
  const user = requireUser(c);
  const { birthYear, ...plan } = c.body as { birthYear?: number } & Omit<import("./db").DemoWealthPlan, "id" | "userId" | "updatedAt">;
  if (birthYear) user.birthYear = birthYear;
  const existing = c.db.wealthPlans.find((p) => p.userId === user.id);
  if (existing) Object.assign(existing, plan, { updatedAt: nowIso() });
  else c.db.wealthPlans.push({ id: newId("plan"), userId: user.id, ...plan, updatedAt: nowIso() });
  return { snapshot: snapshotFor(c.db, user) };
});
on("GET", "/wealth/fp", (c) => {
  const user = requireUser(c);
  return { messages: c.db.fpMessages.filter((m) => m.userId === user.id), claudeEnabled: false };
});
on("POST", "/wealth/fp", (c) => {
  const user = requireUser(c);
  const question = String((c.body as { question: string }).question ?? "").trim();
  if (!question) throw new HttpError(400, "質問を入力してください");
  const answer = ruleBasedAnswer(snapshotFor(c.db, user), question);
  c.db.fpMessages.push({ id: newId("fp"), userId: user.id, role: "user", content: question, createdAt: nowIso() });
  const reply = { id: newId("fp"), userId: user.id, role: "assistant", content: answer, createdAt: nowIso() };
  c.db.fpMessages.push(reply);
  return { status: 201, data: { reply, source: "rules" } };
});
on("DELETE", "/wealth/fp", (c) => {
  const user = requireUser(c);
  c.db.fpMessages = c.db.fpMessages.filter((m) => m.userId !== user.id);
  return { ok: true };
});

// ---------- 契約・経費・相談 ----------
on("GET", "/contracts", (c) => {
  const user = requireUser(c);
  const engs = engagementsOf(c.db, user.id);
  return {
    contracts: c.db.contracts
      .filter((ct) => engs.some((e) => e.id === ct.engagementId))
      .map((ct) => ({ ...ct, engagement: engs.find((e) => e.id === ct.engagementId)! }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
});
on("POST", "/contracts/:id/sign", (c) => {
  const user = requireUser(c);
  const ct = c.db.contracts.find((x) => x.id === c.params[0]);
  const e = ct && c.db.engagements.find((x) => x.id === ct.engagementId);
  if (!ct || !e || e.userId !== user.id) throw new HttpError(404, "契約書が見つかりません");
  if (ct.status === "締結済み") throw new HttpError(400, "既に締結済みです");
  Object.assign(ct, { status: "締結済み", signedAt: nowIso(), signedName: (c.body as { signedName: string }).signedName });
  return { contract: ct };
});
on("GET", "/expenses", (c) => {
  const user = requireUser(c);
  return { expenses: c.db.expenses.filter((x) => x.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)) };
});
on("POST", "/expenses", (c) => {
  const user = requireUser(c);
  const b = c.body as { date: string; vendor: string; amount: number; category: string; memo?: string | null };
  const expense = { id: newId("exp"), userId: user.id, date: new Date(b.date).toISOString(), vendor: b.vendor, amount: b.amount, category: b.category, memo: b.memo ?? null, ocrRawText: null, createdAt: nowIso() };
  c.db.expenses.push(expense);
  return { status: 201, data: { expense } };
});
on("DELETE", "/expenses/:id", (c) => {
  const user = requireUser(c);
  c.db.expenses = c.db.expenses.filter((x) => !(x.id === c.params[0] && x.userId === user.id));
  return { status: 204, data: {} };
});
on("GET", "/mentor", (c) => {
  const user = requireUser(c);
  return { requests: c.db.mentorRequests.filter((r) => r.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
});
on("POST", "/mentor", (c) => {
  const user = requireUser(c);
  const b = c.body as { topic: string; message: string };
  if (!b.topic?.trim() || !b.message?.trim()) throw new HttpError(400, "入力内容を確認してください");
  const request = { id: newId("mentor"), userId: user.id, topic: b.topic, message: b.message, status: "受付中", createdAt: nowIso() };
  c.db.mentorRequests.push(request);
  return { status: 201, data: { request } };
});
function chatThread(c: Ctx, userId: string) {
  const list = c.db.chatMessages.filter((m) => m.userId === userId);
  return [
    { id: "welcome", from: "staff", text: CHAT_WELCOME, auto: true, createdAt: list[0]?.createdAt ?? nowIso() },
    ...list.map((m) => ({ id: m.id, from: m.role === "user" ? "user" : "staff", text: m.content, auto: !!m.auto, createdAt: m.createdAt })),
  ];
}
on("GET", "/chat", (c) => ({ messages: chatThread(c, requireUser(c).id) }));
on("POST", "/chat", (c) => {
  const user = requireUser(c);
  const text = String((c.body as { text: string }).text ?? "").trim();
  if (!text) throw new HttpError(400, "メッセージを入力してください");
  const now = Date.now();
  c.db.chatMessages.push({ id: newId("chat"), userId: user.id, role: "user", content: text, createdAt: new Date(now).toISOString() });
  c.db.chatMessages.push({ id: newId("chat"), userId: user.id, role: "staff", content: autoReply(text), auto: true, createdAt: new Date(now + 1).toISOString() });
  return { status: 201, data: { messages: chatThread(c, user.id) } };
});

// ---------- カレンダー・ToDo ----------
const sortTasks = (a: DemoTask, b: DemoTask) =>
  (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? "") || a.createdAt.localeCompare(b.createdAt);
on("GET", "/planner", (c) => {
  const user = requireUser(c);
  const eventIds = new Set(c.db.eventApplications.filter((a) => a.userId === user.id).map((a) => a.eventId));
  const current = engagementsOf(c.db, user.id).find((e) => e.status === "稼働中") ?? null;
  const auto = buildAutoItems({
    now: new Date(),
    appliedEvents: c.db.events.filter((e) => eventIds.has(e.id)).map((e) => ({ id: e.id, title: e.title, date: new Date(e.date) })),
    unpaidInvoices: invoicesOf(c.db, user.id)
      .filter((i) => !i.paidAt)
      .map((inv) => withEngagement(c.db, inv))
      .map((i) => ({ id: i.id, targetMonth: i.targetMonth, dueDate: d(i.dueDate), paidAt: null, client: i.engagement.project.client })),
    currentEngagement: current ? { endDate: d(current.endDate), project: current.project } : null,
  });
  return { tasks: c.db.tasks.filter((t) => t.userId === user.id).sort(sortTasks), auto };
});
function taskFields(b: Body) {
  const out: Partial<DemoTask> = {};
  if (typeof b.title === "string") {
    if (!b.title.trim()) throw new HttpError(400, "入力内容を確認してください");
    out.title = b.title.trim().slice(0, 100);
  }
  if (b.kind === "todo" || b.kind === "event") out.kind = b.kind;
  if ("date" in b) out.date = (b.date as string | null) || null;
  if ("time" in b) out.time = (b.time as string | null) || null;
  if ("memo" in b) out.memo = (b.memo as string | null) || null;
  return out;
}
on("POST", "/planner/tasks", (c) => {
  const user = requireUser(c);
  const f = taskFields(c.body);
  if (!f.title) throw new HttpError(400, "入力内容を確認してください");
  if (f.kind === "event" && !f.date) throw new HttpError(400, "予定には日付を入れてください");
  const task: DemoTask = { id: newId("task"), userId: user.id, title: f.title, kind: f.kind ?? "todo", date: f.date ?? null, time: f.time ?? null, memo: f.memo ?? null, doneAt: null, createdAt: nowIso() };
  c.db.tasks.push(task);
  return { status: 201, data: { task } };
});
on("PATCH", "/planner/tasks/:id", (c) => {
  const user = requireUser(c);
  const task = c.db.tasks.find((t) => t.id === c.params[0] && t.userId === user.id);
  if (!task) throw new HttpError(404, "見つかりません");
  Object.assign(task, taskFields(c.body));
  if (typeof c.body.done === "boolean") task.doneAt = c.body.done ? nowIso() : null;
  return { task };
});
on("DELETE", "/planner/tasks/:id", (c) => {
  const user = requireUser(c);
  c.db.tasks = c.db.tasks.filter((t) => !(t.id === c.params[0] && t.userId === user.id));
  return { status: 204, data: {} };
});

// ---------- 運営 ----------
on("GET", "/admin/inbox", (c) => {
  requireAdmin(c);
  const { db } = c;
  const userOf = (id: string) => db.users.find((u) => u.id === id);
  const threads = new Map<string, { userId: string; name: string; email: string; lastText: string; lastAt: string; waiting: boolean; count: number }>();
  for (const m of [...db.chatMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const u = userOf(m.userId);
    if (!u) continue;
    const t = threads.get(m.userId) ?? { userId: m.userId, name: u.name, email: u.email, lastText: "", lastAt: m.createdAt, waiting: false, count: 0 };
    if (m.role === "user") {
      t.lastText = m.content;
      t.waiting = true;
      t.count += 1;
    } else if (!m.auto) t.waiting = false;
    t.lastAt = m.createdAt;
    threads.set(m.userId, t);
  }
  return {
    mentor: [...db.mentorRequests]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ ...r, user: { name: userOf(r.userId)?.name ?? "退会した会員", email: userOf(r.userId)?.email ?? "" } })),
    chats: [...threads.values()].sort((a, b) => Number(b.waiting) - Number(a.waiting) || b.lastAt.localeCompare(a.lastAt)),
  };
});
on("PATCH", "/admin/mentor/:id", (c) => {
  requireAdmin(c);
  const r = c.db.mentorRequests.find((x) => x.id === c.params[0]);
  if (!r) throw new HttpError(404, "相談が見つかりません");
  const status = (c.body as { status: string }).status;
  if (!["受付中", "対応中", "完了"].includes(status)) throw new HttpError(400, "状態を選んでください");
  r.status = status;
  return { request: r };
});
on("GET", "/admin/chat/:userId", (c) => {
  requireAdmin(c);
  return { messages: chatThread(c, c.params[0]) };
});
on("POST", "/admin/chat/:userId", (c) => {
  requireAdmin(c);
  const text = String((c.body as { text: string }).text ?? "").trim();
  if (!text) throw new HttpError(400, "メッセージを入力してください");
  if (!c.db.users.some((u) => u.id === c.params[0])) throw new HttpError(404, "会員が見つかりません");
  c.db.chatMessages.push({ id: newId("chat"), userId: c.params[0], role: "staff", content: text, createdAt: nowIso() });
  return { status: 201, data: { messages: chatThread(c, c.params[0]) } };
});
on("GET", "/admin/leads", (c) => {
  requireAdmin(c);
  const { db } = c;
  const now = Date.now();
  const members = db.users.filter((u) => u.role === "member").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const since14 = ymd(new Date(now - 14 * DAY));
  const referralCounts = new Map<string, number>();
  for (const u of members) if (u.referredById) referralCounts.set(u.referredById, (referralCounts.get(u.referredById) ?? 0) + 1);
  const leads = members
    .map((u) => {
      const current = db.engagements.find((e) => e.userId === u.id && e.status === "稼働中");
      const daysLeft = current?.endDate ? Math.ceil((new Date(current.endDate).getTime() - now) / DAY) : null;
      const clubs = db.clubMemberships.filter((m) => m.userId === u.id).map((m) => db.clubs.find((x) => x.id === m.clubId)!.name);
      const sheet = db.skillSheets.find((s) => s.userId === u.id);
      const { score, reasons } = scoreLead({
        workStyle: u.workStyle,
        currentEngagementDaysLeft: daysLeft,
        hasCurrentEngagement: !!current,
        hasSkillSheet: !!sheet,
        rateDiagnosisCount: db.rateDiagnoses.filter((r) => r.userId === u.id).length,
        clubCount: clubs.length,
        eventCount: db.eventApplications.filter((a) => a.userId === u.id).length,
        loggedHealthRecently: db.healthLogs.some((l) => l.userId === u.id && l.date >= since14),
        referred: !!u.referredById,
        referralCount: referralCounts.get(u.id) ?? 0,
      });
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        workStyle: u.workStyle,
        signupSource: u.signupSource,
        createdAt: u.createdAt,
        clubs,
        currentProject: current ? { title: projectOf(db, current.projectId).title, monthlyRate: current.monthlyRate, daysLeft } : null,
        desiredRate: sheet?.desiredRate ?? null,
        score,
        reasons,
        referralCount: referralCounts.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  const bySource: Record<string, number> = {};
  for (const u of members) bySource[u.signupSource ?? "direct"] = (bySource[u.signupSource ?? "direct"] ?? 0) + 1;
  const count = (ws: string) => members.filter((u) => u.workStyle === ws).length;

  return {
    summary: {
      totalMembers: members.length,
      newLast30Days: members.filter((u) => new Date(u.createdAt).getTime() >= now - 30 * DAY).length,
      byWorkStyle: { freelance: count("freelance"), ses_employee: count("ses_employee"), considering: count("considering") },
      hotLeads: leads.filter((l) => l.score >= 50).length,
      bySource,
    },
    leads,
    clubs: [...db.clubs].sort((a, b) => a.sortOrder - b.sortOrder).map((x) => ({ id: x.id, name: x.name, slug: x.slug, members: db.clubMemberships.filter((m) => m.clubId === x.id).length })),
    events: db.events
      .filter((e) => new Date(e.date).getTime() >= now - DAY)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date,
        capacity: e.capacity,
        applications: db.eventApplications.filter((a) => a.eventId === e.id).length,
        club: e.clubId ? db.clubs.find((x) => x.id === e.clubId)?.name ?? null : null,
        hasJoinUrl: !!e.joinUrl,
      })),
  };
});

// ---------- 入口 ----------
function userFromToken(db: DemoDB, token: string | null) {
  if (!token?.startsWith("demo:")) return null;
  return db.users.find((u) => u.id === token.slice(5)) ?? null;
}

function dispatch(db: DemoDB, method: string, fullPath: string, body: Body, token: string | null): DemoResponse {
  const [path, qs = ""] = fullPath.split("?");
  for (const [m, re, h] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (!match) continue;
    const ctx: Ctx = { db, method, path, query: new URLSearchParams(qs), body, user: userFromToken(db, token), params: match.slice(1) };
    try {
      const out = h(ctx);
      if (out && typeof out === "object" && "status" in out && "data" in out) return out as DemoResponse;
      return { status: 200, data: out };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, data: { error: e.message } };
      throw e;
    }
  }
  return { status: 404, data: { error: "デモ版では使えない機能です" } };
}

// ブラウザから: 変更は localStorage に保存する
export function demoFetch(method: string, path: string, body: unknown, token: string | null): DemoResponse {
  const res = dispatch(getDB(), method, path, (body ?? {}) as Body, token);
  if (method !== "GET" && res.status < 400) saveDB();
  return res;
}

// ビルド時の公開ページ描画用（ログインなし・保存しない）
export function demoServerFetch(path: string): DemoResponse {
  return dispatch(freshDB(), "GET", path, {}, null);
}

// ダウンロード（デモではカレンダーとCSVだけ作れる）
export function demoDownload(path: string, token: string | null): { content: string; type: string } {
  const db = getDB();
  const user = userFromToken(db, token);
  const ics = path.match(/^\/events\/([^/]+)\/calendar\.ics$/);
  if (ics && user) {
    const e = db.events.find((x) => x.id === ics[1]);
    if (e) {
      const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const start = new Date(e.date);
      const end = new Date(start.getTime() + e.durationMin * 60_000);
      const content = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SOTOBA Demo//JA",
        "BEGIN:VEVENT",
        `UID:${e.id}@sotoba`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${e.title}`,
        `LOCATION:${e.isOnline && e.joinUrl ? e.joinUrl : e.location}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      return { content, type: "text/calendar" };
    }
  }
  if (path === "/expenses/export.csv" && user) {
    const rows = db.expenses.filter((x) => x.userId === user.id).map((x) => ({ ...x, date: new Date(x.date) }));
    return { content: buildExpenseCsv(rows), type: "text/csv" };
  }
  throw new HttpError(501, "デモ版ではPDF・Excelのダウンロードはできません（実際のアプリでは出力されます）");
}

export { HttpError as DemoHttpError };
