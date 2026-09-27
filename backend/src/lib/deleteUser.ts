import { prisma } from "./prisma";

// 会員と、その会員が保存したデータをすべて消す（退会・シードの掃除で使う）
// 単価診断の申告は、個人と結びつかない形で比較データに残す
export async function deleteUserData(userId: string) {
  const engagementIds = (await prisma.engagement.findMany({ where: { userId }, select: { id: true } })).map((e) => e.id);
  await prisma.$transaction([
    prisma.invoice.deleteMany({ where: { engagementId: { in: engagementIds } } }),
    prisma.contract.deleteMany({ where: { engagementId: { in: engagementIds } } }),
    prisma.engagement.deleteMany({ where: { userId } }),
    prisma.project.deleteMany({ where: { isListed: false, engagements: { none: {} } } }),
    prisma.skillSheet.deleteMany({ where: { userId } }),
    prisma.eventApplication.deleteMany({ where: { userId } }),
    prisma.mentorRequest.deleteMany({ where: { userId } }),
    prisma.rateDiagnosis.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.expense.deleteMany({ where: { userId } }),
    prisma.clubMembership.deleteMany({ where: { userId } }),
    prisma.healthLog.deleteMany({ where: { userId } }),
    prisma.wealthPlan.deleteMany({ where: { userId } }),
    prisma.fpMessage.deleteMany({ where: { userId } }),
    prisma.task.deleteMany({ where: { userId } }),
    prisma.chatMessage.deleteMany({ where: { userId } }),
    prisma.user.updateMany({ where: { referredById: userId }, data: { referredById: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
