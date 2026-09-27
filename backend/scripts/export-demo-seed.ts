// デモ版（GitHub Pages）の初期データを書き出す: npm run seed のあとに npm run export:demo
// パスワードのハッシュは含めない。日付はデモ表示時に「書き出した日からの経過日数」だけずらして、常に今日基準に見せる
import { writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, projects, engagements, invoices, contracts, skillSheets, events, eventApplications, clubs, clubMemberships, healthLogs, wealthPlans, rateDiagnoses, expenses, mentorRequests, tasks, chatMessages] =
    await Promise.all([
      prisma.user.findMany({ where: { email: { endsWith: "@example.com" } } }),
      prisma.project.findMany(),
      prisma.engagement.findMany(),
      prisma.invoice.findMany(),
      prisma.contract.findMany(),
      prisma.skillSheet.findMany(),
      prisma.event.findMany(),
      prisma.eventApplication.findMany(),
      prisma.club.findMany(),
      prisma.clubMembership.findMany(),
      prisma.healthLog.findMany(),
      prisma.wealthPlan.findMany(),
      prisma.rateDiagnosis.findMany(),
      prisma.expense.findMany(),
      prisma.mentorRequest.findMany(),
      prisma.task.findMany(),
      prisma.chatMessage.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  const userIds = new Set(users.map((u) => u.id));
  const own = <T extends { userId: string | null }>(rows: T[]) => rows.filter((r) => r.userId == null || userIds.has(r.userId));

  const seed = {
    exportedAt: new Date().toISOString(),
    users: users.map(({ passwordHash: _omit, ...u }) => u),
    projects,
    engagements: own(engagements),
    invoices,
    contracts,
    skillSheets: own(skillSheets),
    events,
    eventApplications: own(eventApplications),
    clubs,
    clubMemberships: own(clubMemberships),
    healthLogs: own(healthLogs),
    wealthPlans: own(wealthPlans),
    rateDiagnoses: own(rateDiagnoses),
    expenses: own(expenses),
    mentorRequests: own(mentorRequests),
    tasks: own(tasks),
    // デモ版は role / content の形で持つ
    chatMessages: own(chatMessages).map((m) => ({ id: m.id, userId: m.userId, role: m.from, content: m.text, auto: m.auto, createdAt: m.createdAt })),
  };

  const out = path.join(__dirname, "../../frontend/src/demo/seed.json");
  writeFileSync(out, JSON.stringify(seed, null, 1) + "\n");
  console.log(`書き出しました: ${out}`);
}

main().finally(() => prisma.$disconnect());
