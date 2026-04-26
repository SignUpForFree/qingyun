import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
