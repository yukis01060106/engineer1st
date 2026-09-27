// 招待リンク（?ref=会員ID）で来た人を、登録するまで覚えておく
const KEY = "engineer1st_ref";

export function captureReferral() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[\w-]{6,64}$/.test(ref)) sessionStorage.setItem(KEY, ref);
  } catch {
    // ストレージが使えない環境では何もしない
  }
}

export function getReferral(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearReferral() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}
