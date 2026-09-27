"use client";

import { IS_DEMO, BASE_PATH } from "../lib/demo";

// デモ版だけに出す帯。操作した内容は見ている人のブラウザにだけ保存される
export function DemoBanner() {
  if (!IS_DEMO) return null;

  async function reset() {
    if (!window.confirm("デモのデータを最初の状態に戻します。よろしいですか？")) return;
    const { resetDB } = await import("../demo/db");
    const { clearToken } = await import("../api/client");
    resetDB();
    clearToken();
    window.location.href = `${BASE_PATH}/`;
  }

  return (
    <div className="demo-banner" role="note">
      <span>
        <strong>デモ版</strong>　ログイン：tanaka@example.com / password123（運営は admin@example.com）。操作した内容はこのブラウザにだけ保存されます。
      </span>
      <button type="button" onClick={reset}>
        最初からやり直す
      </button>
    </div>
  );
}
