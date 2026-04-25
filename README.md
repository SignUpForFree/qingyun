# 轻运 AI

> AI 占卜与每日运势 · 1 人 5 周 Web MVP
> Next.js 16 + Supabase + DeepSeek + lunar-javascript

## 启动

```bash
# 1) 装依赖
pnpm install

# 2) 复制环境变量模板（W1 D1-D5 期间所有字段可留空）
cp .env.example .env.local

# 3) 跑 dev server
pnpm dev          # → http://localhost:3000

# 4) 健康检查
curl http://localhost:3000/api/healthz
# {"ok":true,"service":"qingyun-ai","time":"..."}
```

## 脚本

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 起 dev server (Turbopack) |
| `pnpm build` | 生产构建 |
| `pnpm start` | 起 production server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | Vitest 单测一次跑完 |
| `pnpm test:watch` | Vitest watch 模式 |
| `pnpm test:coverage` | Vitest + 覆盖率（阈值 lib/** 80%） |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm format` | Prettier 全量格式化 |

## 文档

| 类别 | 路径 |
|---|---|
| 设计方案（spec） | `docs/superpowers/specs/2026-04-24-qingyun-ai-design.md` |
| P1 骨架（W1-W2） | `docs/superpowers/plans/2026-04-24-qingyun-ai-p1-skeleton.md` |
| P2 功能（W3-W4） | `docs/superpowers/plans/2026-04-24-qingyun-ai-p2-features.md` |
| P3 上线（W5） | `docs/superpowers/plans/2026-04-24-qingyun-ai-p3-launch.md` |
| 跨文档审计 | `docs/superpowers/specs/2026-04-26-cross-doc-audit.md` |
| 视觉 prompts | `docs/superpowers/designs/prompts-all-pages.md` |
| 八字测试用例 | `docs/superpowers/specs/bazi-test-cases.md`（C1 后生成） |

## 测试

- 单测：`lib/**/*.test.ts`，jsdom 环境 + Testing Library
- 覆盖率阈值（仅 `lib/**`）：lines / functions / statements ≥ 80%，branches ≥ 70%
- E2E：`e2e/*.spec.ts`，Playwright + Chromium，自动起 dev server

## 当前阶段（2026-04-26 深夜）

P1 W1 全部"零外部依赖"任务已完成（A/S/C/D/E + Section B 凭据无关骨架）：

- ✅ Section A — Next.js 16 + Tailwind 4 + shadcn/ui + Vitest + Playwright + Prettier
- ✅ Section S — 素笺仙气视觉系统（token + 仙气原子组件 + AppShell/Header/BottomNav）
- ✅ Section C — 八字算法（真太阳时 + 干支五行十神 + 大运 8 步 + 47 单测全绿）
- ✅ Section D — AI Gateway（DeepSeek provider + prompts + 限流 + chat()，全 mock）
- ✅ Section E — 意图路由（5 分类 18 单测）
- ⏸ Section B — migrations / supabase clients / middleware 骨架已就位，**等用户填 `.env.local`**
- ⏸ Section F/G — onboarding + chat 页，等 B 完成后续

**用户起床后**：照 [db/SETUP.md](./db/SETUP.md) 5 步操作（注册 Supabase / 填 .env.local / 装 CLI / link / db push）即可继续。

**已通过验证**：

```bash
pnpm test          # 92 passed | 2 skipped
pnpm typecheck     # 0 errors
pnpm lint          # 0 errors
pnpm build         # 0 errors
pnpm dev           # http://localhost:3000 看到素笺仙气首页 + /chat /me /api/healthz
```
