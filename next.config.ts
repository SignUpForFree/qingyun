import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许 127.0.0.1 访问 dev 资源（HMR WebSocket / Turbopack），否则用 IP 访问时 JS 加载失败
  allowedDevOrigins: ["127.0.0.1"],
  // Docker 镜像用 standalone 输出，体积小启动快（参 coin 项目模式）
  output: "standalone",
  // better-sqlite3 + lunar-javascript + @napi-rs/canvas 是 nodejs-only，不打 edge
  // @napi-rs/canvas 含 .node 原生 binding，Turbopack ESM 打包会报 non-ecmascript placeable asset，
  // 必须 external 出来由 Node runtime 自行 require。
  serverExternalPackages: [
    "better-sqlite3",
    "lunar-javascript",
    "@napi-rs/canvas",
  ],
  // 2026-05-09：prod standalone 默认很安静，这里把服务端 fetch 日志开起来，
  // 配合 middleware.ts 的 [req] 行 + 应用 console.log，docker compose logs 全可读
  logging: {
    fetches: { fullUrl: true },
    incomingRequests: true,
  },
};

export default nextConfig;
