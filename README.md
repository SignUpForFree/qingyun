# 轻运 AI

> AI 占卜与每日运势 · 1 人 5 周 Web MVP
> Next.js 16 + SQLite + Drizzle + DeepSeek + lunar-javascript
>
> **本地优先**：数据库走本地 SQLite（一个 `dev.db` 文件），不依赖 docker / 云服务。

## 启动

```bash
# 1) 装依赖
pnpm install

# 2) 复制环境变量模板（首次跑 .env.local 全部留空也能正常起 dev）
cp .env.example .env.local

# 3) （首次）生成 schema migration —— 已有 db/migrations-sqlite/ 可跳过
pnpm db:generate

# 4) 跑 dev server （proxy.ts + lib/db/client.ts 自动 migrate, 自动建 dev.db）
pnpm dev          # → http://localhost:3000

# 5) 健康检查
curl http://localhost:3000/api/healthz
# {"ok":true,"service":"qingyun-ai","time":"..."}
```

## 数据库

| 命令 | 用途 |
|---|---|
| `pnpm db:generate` | 改 `lib/db/schema.ts` 后跑这个生成新 SQL migration |
| `pnpm db:migrate` | 手动应用 migration 到 `dev.db`（dev/prod 启动时也会自动跑） |
| `pnpm db:studio` | 打开 Drizzle Studio Web UI 查表 |
| `pnpm db:reset` | 删 `dev.db` 后重 migrate |

匿名 user_id 由 `proxy.ts` 写到 cookie `qy_uid`，没有"账号"概念。所有 user 数据通过 `user_id` 字段过滤（service 层显式 where，不依赖 RLS）。

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

P1（骨架期 W1-W2）**全部代码已落地**，等用户配置 Supabase Cloud 凭据即可贯通：

| Section | 状态 | 内容 |
|---|---|---|
| A1-A4 | ✅ | Next.js 16 + Tailwind 4 + shadcn/ui + Vitest + Playwright + Prettier + healthz |
| S1-S3 | ✅ | 素笺仙气 token + Sparkle/GlassCard/WatercolorDot/Divider + AppShell |
| C1-C5 | ✅ | 真太阳时 + 干支五行十神 + buildChart + DST 修 + 47 单测 |
| D1-D4 | ✅ | DeepSeek provider + prompts + rate-limit + chat() (全 mock) + 27 单测 |
| E1 | ✅ | 意图路由 5 分类 + 18 单测 |
| B1-B6 | ✅ | drizzle schema + migrations + auth/session shim + proxy.ts 自动匿名登录 |
| F1-F5 | ✅ | profile 工具 + onboarding 3 步 wizard + DatePicker + RegionPicker + /api/profile |
| G1-G5 | ✅ | /api/chat SSE + chat UI + HistoryDrawer + 升级首页 + /me |
| H1-H4 | ⏸ | DoD 验收 — 等 DEEPSEEK_API_KEY 接入后跑流式全链路 |

**全仓状态**：

```bash
pnpm test          # 117 passed | 2 skipped (12 test files)
pnpm typecheck     # 0 errors
pnpm lint          # 0 errors
pnpm build         # 9 routes (/, /chat, /chat/[sessionId], /me, /onboarding,
                   #            /api/healthz, /api/profile, /api/chat, /api/conversations + middleware)
```

## 全链路（无需任何外部凭据即可走通建档 + 入库）

```bash
pnpm dev
```

1. 访问 `/` → `proxy.ts` 自动写入 `qy_uid` cookie（匿名 user）
2. `/onboarding` 3 步 → 提交 → `POST /api/profile` 写 `profiles` + `bazi_charts`
3. `/me` 显示档案；`/chat` 4 快捷入口
4. **填了 `DEEPSEEK_API_KEY`** 后 → `/chat/<id>` 流式 SSE 对话能跑通
5. 没填 key 的话发消息会 toast `AI 暂时无响应 (500)`

## 还差什么

- W3 起 P2 计划：5 功能闭环（抽签/解梦/八字/梅花/运势）+ 梅花 V1.0 算法 + W3 硬 gate
- W5 起 P3 计划：上线必备三件套（敏感词/PWA/微信回归/埋点/部署/反馈）
- 八字测试 case 2 / case 3 ground truth — 等用户用权威 App 校对后启用 `it.skip` → `it`
- 视觉走查：每个 UI 任务都标记了"对照 prompts-all-pages.md §X"的 checklist，建议跑一遍 dev 截图存档
