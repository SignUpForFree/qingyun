# Supabase 接入指南

> **2026-04-26 深夜版** · 用户起床后照此操作即可继续 W2 任务（B5/B6/F/G）。

## 第一步：注册 Supabase Cloud（5 min · 免费）

1. 打开 https://supabase.com/dashboard
2. 用 GitHub / Google 登录（推荐 GitHub）
3. 新建组织（默认 free tier 即可）
4. 新建项目：
   - 名称：`qingyun-ai-dev`
   - 区域：`Northeast Asia (Tokyo)` 或 `East Asia (Seoul)`
   - 数据库密码：随便起一个，**保存到密码管理器**（后续 `db push` 会用）
   - 等待 ~2 min 项目创建完成

## 第二步：取 3 个 key 填到 `.env.local`

进入项目 → Settings → API：

```
Project URL                → NEXT_PUBLIC_SUPABASE_URL
anon public key            → NEXT_PUBLIC_SUPABASE_ANON_KEY
service_role secret key    → SUPABASE_SERVICE_ROLE_KEY
```

把这 3 个值填到本仓库根目录的 `.env.local`（先 `cp .env.example .env.local`）。

> **service_role key 是高权限 key**，会绕过 RLS。仅服务端用，永远不要泄露给客户端或 commit 到 git。`.gitignore` 已屏蔽 `.env.local`。

## 第三步：装 Supabase CLI（不需要 Docker）

```bash
brew install supabase/tap/supabase
supabase --version    # 应输出 1.x 或 2.x
```

> CLI 本身不依赖 docker。docker 只在 `supabase start`（本地 db）时才用，本项目走 cloud-only 跳过。

## 第四步：登录 + 链接到云端项目

```bash
supabase login
# 浏览器授权（基于 GitHub login 或 Personal Access Token）

# 进项目根
cd /Users/edy/Desktop/workspace/occult

# 链接到 cloud 项目（<project-ref> 在 Settings → General → Reference ID）
supabase link --project-ref <project-ref>
# 提示输入数据库密码 → 输入第一步保存的密码
```

## 第五步：把 migrations 推到云端

仓库已经备好 3 个 migration（`db/migrations/0001_init_schema.sql` / `0002_rls.sql` / `0003_storage_buckets.sql`），但 supabase CLI 期望 migrations 在 `supabase/migrations/` 下，所以先跑 `supabase init`：

```bash
supabase init     # 生成 supabase/config.toml + supabase/migrations/

# 把仓库的 migration 拷到 supabase 期望路径（带时间戳前缀）
ts=$(date +%Y%m%d%H%M%S)
cp db/migrations/0001_init_schema.sql       "supabase/migrations/${ts}_init_schema.sql"
sleep 1; ts=$(date +%Y%m%d%H%M%S)
cp db/migrations/0002_rls.sql                "supabase/migrations/${ts}_rls.sql"
sleep 1; ts=$(date +%Y%m%d%H%M%S)
cp db/migrations/0003_storage_buckets.sql    "supabase/migrations/${ts}_storage_buckets.sql"

# 推到云端 dev 项目
supabase db push
```

成功后到 Dashboard → Table Editor 应看到 9 张表：
`profiles / bazi_charts / fortunes / conversations / messages / divination_records / prompts / divination_slips / hexagrams`

## 第六步：开启匿名登录

Dashboard → Authentication → Providers → **Anonymous Sign-Ins** → Enable。

## 第七步：生成 TypeScript 类型（可选但推荐）

仓库的 `types/database.ts` 是手写最小占位，建议从 cloud 生成真实版本（含所有列、约束、enum）：

```bash
SUPABASE_PROJECT_REF=<project-ref> ./scripts/gen-types.sh
```

## 完成验证

```bash
# 1) 重启 dev server 让 .env.local 生效
pnpm dev

# 2) 访问首页, 看 dev console 应能看到匿名登录请求（middleware 触发）
# 3) Dashboard → Authentication → Users 应出现一个 anon 用户

# 4) 跑 typecheck 验证 client 三件套
pnpm typecheck
```

## 完成后告诉我

我会从 Section B5 开始继续：

- B5：types/domain.ts 关联 Database 类型 ✓（已部分完成）
- B6：middleware 自动匿名登录 ✓（已写代码骨架）
- F：onboarding 3 步表单
- G：/api/chat SSE + 对话页

---

## 故障排查

### `supabase db push` 报错 "permission denied"

进 Dashboard → Settings → Database → Connection Pooler，确认 mode = `Transaction`。
或换用直连：`supabase db push --db-url "$DIRECT_DB_URL"` （从 Settings → Database → Connection string → URI）。

### middleware 请求一直转圈 / 401

通常是 `NEXT_PUBLIC_SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 拼错。重启 dev server 让 `.env.local` 生效。

### service_role key 弄丢了

Dashboard → Settings → API → 点 `service_role` 旁边眼睛图标显示 → 拷贝。或点 `Reset` 重新生成（会让现有 key 失效）。
