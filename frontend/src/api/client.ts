import { IS_DEMO } from "../lib/demo";

const TOKEN_KEY = "sotoba_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ストレージが使えない環境では何もしない
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  // デモ版: ブラウザ内のデモサーバーに問い合わせる（通信しない）
  if (IS_DEMO) {
    const { demoFetch } = await import("../demo/api");
    const body = typeof options.body === "string" ? JSON.parse(options.body) : undefined;
    const res = demoFetch((options.method ?? "GET").toUpperCase(), path, body, token);
    const data = res.data as { error?: string };
    if (res.status >= 400) throw new ApiError(data.error ?? "エラーが発生しました", res.status);
    return res.data as T;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error ?? "エラーが発生しました", res.status);
  }
  return data as T;
}

// 画像などのアップロード（multipart）
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  if (IS_DEMO) {
    throw new ApiError("デモ版では画像の読み取りはできません。「手入力で登録する」をお試しください。", 501);
  }
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "エラーが発生しました", res.status);
  return data as T;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 認証つきでファイルをダウンロードする（PDF・Excel・CSV・ics）
export async function downloadFile(path: string, filename: string) {
  if (IS_DEMO) {
    const { demoDownload, DemoHttpError } = await import("../demo/api");
    try {
      const { content, type } = demoDownload(path, getToken());
      saveBlob(new Blob([content], { type }), filename);
    } catch (e) {
      const message = e instanceof DemoHttpError ? e.message : "ダウンロードに失敗しました";
      window.alert(message);
    }
    return;
  }
  const token = getToken();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new ApiError("ダウンロードに失敗しました", res.status);
  saveBlob(await res.blob(), filename);
}
