// AI FPに渡す本人データをDBから集めて、fpSnapshot で計算する
import { prisma } from "./prisma";
import { computeSnapshot } from "./fpSnapshot";

export { snapshotToText } from "./fpSnapshot";
export type { FinancialSnapshot } from "./fpSnapshot";

export async function buildFinancialSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      engagements: { include: { project: true }, orderBy: { startDate: "desc" } },
      wealthPlan: true,
    },
  });
  if (!user) throw new Error("user not found");
  const invoices = await prisma.invoice.findMany({ where: { engagement: { userId } } });
  return computeSnapshot({ user, engagements: user.engagements, invoices, plan: user.wealthPlan });
}
