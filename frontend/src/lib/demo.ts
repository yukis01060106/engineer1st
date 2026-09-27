// デモ版（GitHub Pages）かどうかと、basePath つきのパス
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// public/ 配下のファイル（写真など）のURL。next/image や <a> で使う（Link と router は自動で basePath がつく）
export const asset = (p: string) => `${BASE_PATH}${p}`;
