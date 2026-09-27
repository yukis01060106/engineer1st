import { IS_DEMO } from "./demo";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

// サーバーコンポーネントから直接バックエンドを叩くためのヘルパー（rewritesは自身のサーバーfetchには適用されないため絶対URLを使う）
export async function serverFetch<T>(path: string, revalidateSeconds = 60): Promise<T> {
  // デモ版: ビルド時にデモデータから描画する
  if (IS_DEMO) {
    const { demoServerFetch } = await import("../demo/api");
    const res = demoServerFetch(path);
    if (res.status >= 400) throw new Error(`API request failed: ${path} (${res.status})`);
    return res.data as T;
  }
  const res = await fetch(`${BACKEND_ORIGIN}/api${path}`, {
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${path} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ビルド時などバックエンドが落ちていてもページ全体を落とさないための版
export async function serverFetchOr<T>(path: string, fallback: T, revalidateSeconds = 60): Promise<T> {
  try {
    return await serverFetch<T>(path, revalidateSeconds);
  } catch (e) {
    console.error(e);
    return fallback;
  }
}
