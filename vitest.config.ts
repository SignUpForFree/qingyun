import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "lib/test-utils/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // globalSetup 在所有测试 worker 启动前的 main process 跑一次，强制把
    // DATABASE_URL 指向 dev.test.db，与 dev server 的 dev.db 隔离
    // （参 docs/ARCHITECTURE.md §3.2-I）。
    globalSetup: ["./vitest.global-setup.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      exclude: ["lib/**/*.test.ts", "lib/**/*.d.ts"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
