import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  try {
    const token = header.slice("Bearer ".length);
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "無効なトークンです" });
  }
}

// ログインしていなくても使える無料ツール向け: トークンがあれば紐付け、なくても素通りする
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const token = header.slice("Bearer ".length);
      req.userId = verifyToken(token).userId;
    } catch {
      // 無効なトークンでも無料ツールは使えるので無視する
    }
  }
  next();
}

// 運営（見込み客の管理・勉強会の告知）専用
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const { prisma } = await import("../lib/prisma");
  const user = req.userId ? await prisma.user.findUnique({ where: { id: req.userId } }) : null;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "運営アカウントのみ利用できます" });
  }
  next();
}
