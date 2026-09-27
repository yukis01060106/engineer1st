"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { BASE_PATH } from "../lib/demo";

// 部活・勉強会に友だちを誘う。ログイン中なら招待リンク（?ref=会員ID）にして、紹介で登録した人を数えられるようにする
export function InviteButton({
  path,
  title,
  text,
  label = "友だちを誘う",
  className = "btn-secondary btn-sm",
  style,
}: {
  path: string;
  title: string;
  text: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(`${BASE_PATH}${path}`, window.location.origin);
    if (user) url.searchParams.set("ref", user.id);
    const href = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: href });
        return;
      } catch {
        // キャンセルされたらコピーに切り替える
      }
    }
    await navigator.clipboard.writeText(`${text}\n${href}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={className} style={style} onClick={share}>
      {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? "誘う文面とリンクをコピーしました" : label}
    </button>
  );
}
