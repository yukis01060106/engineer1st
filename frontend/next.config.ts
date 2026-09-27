import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

// デモ版（GitHub Pages）: NEXT_PUBLIC_DEMO=1 で静的書き出しし、APIはブラウザ内のデモサーバー（src/demo）が答える
const isDemo = process.env.NEXT_PUBLIC_DEMO === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(isDemo
    ? {
        output: "export",
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
        },
      }),
};

export default nextConfig;
