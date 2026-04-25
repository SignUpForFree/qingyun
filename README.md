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

P1（骨架期 W1-W2）**全部代码已落地**，等用户配置 Supabase Cloud 凭据即可贯通：

| Section | 状态 | 内容 |
|---|---|---|
| A1-A4 | ✅ | Next.js 16 + Tailwind 4 + shadcn/ui + Vitest + Playwright + Prettier + healthz |
| S1-S3 | ✅ | 素笺仙气 token + Sparkle/GlassCard/WatercolorDot/Divider + AppShell |
| C1-C5 | ✅ | 真太阳时 + 干支五行十神 + buildChart + DST 修 + 47 单测 |
| D1-D4 | ✅ | DeepSeek provider + prompts + rate-limit + chat() (全 mock) + 27 单测 |
| E1 | ✅ | 意图路由 5 分类 + 18 单测 |
| B1-B6 | ⚙ | 3 SQL migrations + supabase 三件套 + middleware **等用户填 .env.local** |
| F1-F5 | ✅ | profile 工具 + onboarding 3 步 wizard + DatePicker + RegionPicker + /api/profile |
| G1-G5 | ✅ | /api/chat SSE + chat UI + HistoryDrawer + 升级首页 + /me |
| H1-H4 | ⏸ | DoD 验收 — 等 supabase 接入后跑全链路 + `pnpm test:coverage` |

**全仓状态**：

```bash
pnpm test          # 117 passed | 2 skipped (12 test files)
pnpm typecheck     # 0 errors
pnpm lint          # 0 errors
pnpm build         # 9 routes (/, /chat, /chat/[sessionId], /me, /onboarding,
                   #            /api/healthz, /api/profile, /api/chat, /api/conversations + middleware)
```

## 用户起床后的 30 min

照 [`db/SETUP.md`](./db/SETUP.md) 7 步：

1. 注册 supabase.com（5 min · 免费 · 无需信用卡）
2. 从 Settings → API 取 3 个 key 填到 `.env.local`
3. `brew install supabase/tap/supabase`
4. `supabase login` + `supabase link --project-ref <ref>`
5. `supabase init`（生成 `supabase/migrations/`）
6. 从 `db/migrations/*.sql` 拷贝 3 个 migration（带时间戳）→ `supabase db push`
7. Dashboard → Authentication → 启用 Anonymous Sign-Ins

完成后：

```bash
pnpm dev          # 访问 / 自动匿名登录
                  # → 引导建档 → onboarding 3 步 → 提交 → /api/profile insert + 八字排盘
                  # → 跳回 /  →  '进入对话' → /chat 招呼页 → 4 快捷入口 / 自由输入
                  # → /chat/<id> 流式对话（SSE token by token）
                  # → /me 显示档案 + 入口列表
```

## 还差什么

- W3 起 P2 计划：5 功能闭环（抽签/解梦/八字/梅花/运势）+ 梅花 V1.0 算法 + W3 硬 gate
- W5 起 P3 计划：上线必备三件套（敏感词/PWA/微信回归/埋点/部署/反馈）
- 八字测试 case 2 / case 3 ground truth — 等用户用权威 App 校对后启用 `it.skip` → `it`
- 视觉走查：每个 UI 任务都标记了"对照 prompts-all-pages.md §X"的 checklist，建议跑一遍 dev 截图存档
