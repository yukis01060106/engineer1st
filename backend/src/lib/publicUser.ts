import { User } from "@prisma/client";

export const WORK_STYLES = ["freelance", "ses_employee", "considering"] as const;
export type WorkStyle = (typeof WORK_STYLES)[number];

// クライアントに返してよいユーザー情報だけに絞る
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    workStyle: user.workStyle as WorkStyle,
    role: user.role,
    interests: JSON.parse(user.interests) as string[],
  };
}
