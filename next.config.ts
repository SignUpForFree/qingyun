import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 镜像用 standalone 输出，体积小启动快（参 coin 项目模式）
  output: "standalone",
  // better-sqlite3 + lunar-javascript 是 nodejs-only，不打 edge
  serverExternalPackages: ["better-sqlite3", "lunar-javascript"],
};

export default nextConfig;
