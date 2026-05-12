# 轻运 AI（occult） — 工程入口

> 给未来 Claude session 看：本仓库的运行/部署/排错的"立刻能用"的关键信息。
> 详细设计在 `docs/superpowers/specs|plans/`，本文只放上手就用的事实。

## 1. 本地开发

```bash
pnpm dev           # 默认 :3000，被占会自动跳到 3002 / 3010
pnpm typecheck
pnpm test          # vitest，目标 241+ passed
pnpm db:migrate    # drizzle-kit + better-sqlite3
```

`.env.local` 已存在，里面是 ofox 网关 key（`AI_GATEWAY_*`）。**不要**提交。

## 2. 生产服务器（腾讯云，2026-04-29 换机）

> 旧机：`43.129.186.82` + `renliang.pem`（已下线，仅作历史记录）。
> 新机镜像走腾讯云 Docker CE 应用镜像，Ubuntu 24.04 LTS，kernel 6.8。

| 项 | 值 |
|---|---|
| Host | `192.144.226.27` |
| SSH Port | `22` |
| User | `ubuntu` |
| 登录方式 | 密码登录（已配置 `~/.ssh/id_ed25519` 免密，见下方 SSH 配置） |
| OS | Ubuntu 24.04 LTS（hostname `VM-0-10-ubuntu`） |
| 应用目录 | `~/occult`（**不是** git repo，代码靠 docker image 推送） |
| 容器名 | `qingyun-ai`（`docker compose -f ~/occult/docker-compose.yml ps`） |
| 镜像名 | `qingyun-qingyun:latest`（本地 build → scp tar.gz → docker load） |
| 端口 | `0.0.0.0:3000:3000` |
| 数据卷 | `~/occult/data:/app/data`（uid=1001，host ubuntu uid=1000，必须 `sudo chown -R 1001:1001 ~/occult/data`） |
| 公网 | http://192.144.226.27:3000 |
| 健康检查 | `curl -sS http://192.144.226.27:3000/api/healthz` |

### SSH 快捷连接

```bash
# 直接登录
ssh ubuntu@192.144.226.27

# 一行远程命令
ssh ubuntu@192.144.226.27 'docker compose -f ~/occult/docker-compose.yml logs --tail=50 qingyun'
```

> **免密设置（一次性）**：`ssh-copy-id -p 22 ubuntu@192.144.226.27`
> 输入一次密码后，后续所有 ssh/scp 自动用 `~/.ssh/id_ed25519` 免密。

### 本地 → 服务器一键更新（日常部署）

```bash
# 1. 构建 + 导出镜像（~20s）
docker compose build && docker save qingyun-qingyun:latest | gzip > /tmp/qingyun-image.tar.gz

# 2. 上传镜像 + 重启（~30s，需免密 SSH）
scp /tmp/qingyun-image.tar.gz ubuntu@192.144.226.27:~/ && \
ssh ubuntu@192.144.226.27 'docker load < ~/qingyun-image.tar.gz && \
  cd ~/occult && docker compose down && docker compose up -d && \
  echo "✓ done" && docker compose logs --tail=20 qingyun'
```

### 服务器环境：首次部署与自检（按顺序）

线上目录 **`~/occult` 不是 git 仓库**（代码靠 docker image 推送），首次或换机按下面做即可。

1. **登录并进入目录**

```bash
ssh ubuntu@192.144.226.27
cd ~/occult
```

2. **配置 `.env.prod`（至少别留空）**

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

最小建议：

- **AI**：`AI_GATEWAY_API_KEY`（以及模板里已有的 `AI_GATEWAY_BASE_URL` / `AI_GATEWAY_MODEL`，ofox 见下文已知坑 #4）
- **会话**：`SESSION_SECRET` — 在 shell 执行 `openssl rand -base64 64`，把输出粘到 `SESSION_SECRET=` 后（不要指望写在 `.env` 里的 `$(...)` 会被 compose 展开）
- **微信登录**（若启用）：`WECHAT_APPID`、`WECHAT_APPSECRET`，其余 `WECHAT_*` 见 `.env.prod.example`

3. **一键部署**（或等价手动构建）

```bash
bash deploy.sh
# 或（含 Dockerfile / 依赖结构大改时推荐无缓存）
docker compose build --no-cache
docker compose up -d
```

4. **验证（含防 env 丢失）**

```bash
curl -sS http://127.0.0.1:3000/api/healthz
docker compose exec qingyun env | grep AI_GATEWAY_API_KEY   # 必须非空，见已知坑 #8
```

5. **数据卷权限**（容器内运行用户 uid **1001**，宿主机常见为 **1000**，不 `chown` 会 `SQLITE_CANTOPEN`）

```bash
sudo chown -R 1001:1001 ~/occult/data
```

### 一行 SSH

```bash
ssh -i /Users/edy/Downloads/renl.pem -o StrictHostKeyChecking=accept-new ubuntu@192.144.226.27 '<cmd>'
```

### 推改动 + 重建（最常用流程）

**首选：一键脚本（v2，2026-05-09）** —— 替代旧的 docker save/load 跨架构方式：

```bash
bash scripts/deploy-remote.sh        # tar 源码 → 服务器 native build → 滚动切换 + 自动备份
bash scripts/rollback-remote.sh      # 出问题一键回滚到上一个 ~/occult.bak.<ts>
```

**手动 fallback**（脚本失败、或只想改 Dockerfile / compose.yml 等基础设施时）：

```bash
# 在本地
git diff > /tmp/qingyun-fix.patch
scp -i /Users/edy/Downloads/renl.pem /tmp/qingyun-fix.patch ubuntu@192.144.226.27:~/occult/

# 在服务器
ssh -i /Users/edy/Downloads/renl.pem ubuntu@192.144.226.27
cd ~/occult
git apply qingyun-fix.patch       # 注意：~/occult 不是 git repo，但 git apply 不依赖
docker compose build --no-cache   # 必须 --no-cache，否则 Dockerfile 改动可能不生效
docker compose up -d
docker compose logs --tail=30 qingyun
curl -sS http://127.0.0.1:3000/api/healthz
```

### 验证 API（外部）

```bash
curl -sS http://192.144.226.27:3000/api/healthz
```

## 3. 已知坑 / 反复踩

1. **`conversationId: null` 必须用 `.nullish()` 不是 `.optional()`** — 4 个 route schema：`/api/chat`、`/api/divination/{qianwen,bazi,meihua}`。ChatWindow 首次会话显式传 `null`，`.optional()` 只接 string|undefined 会 400。dream 路由是手解析 typeof 的不受影响。
2. **Cookie secure flag** 走 `lib/auth/cookie-flags.ts` 的 `shouldSecureCookie()`，env `COOKIE_SECURE=false`（线上是 http 直连）。上 https 后删这个 env。
3. **腾讯云安全组 :3000** 必须放通入站 TCP `0.0.0.0/0 → 3000`。出现"内部 healthz 200，外部 timeout 000"就是 SG 没生效（不是 docker / iptables 的问题）。
4. **AI 网关** 用 `lib/ai/gateway.ts` 抽象，env 优先级 `AI_GATEWAY_* > DEEPSEEK_* > 默认`。线上是 ofox.ai 聚合：
   - `AI_GATEWAY_BASE_URL=https://api.ofox.ai/v1`
   - `AI_GATEWAY_MODEL=deepseek/deepseek-v4-pro`（注意 `provider/model` 命名空间）
5. **pnpm isolated layout** native 依赖在 `node_modules/.pnpm/`，**不要**在 Dockerfile 里显式 COPY native deps，Next standalone 已经 trace 进 `.next/standalone/node_modules/.pnpm/`。
6. **数据卷 uid 漂移** 容器 nextjs uid=1001 ≠ host ubuntu uid=1000 → SQLITE_CANTOPEN。`sudo chown -R 1001:1001 ~/occult/data`。
7. **chat 路径必须 hideNav** — `BottomNav` 与各 sticky bottom-0 的 ChatInput/Launcher z-index 冲突，已在 `components/layout/BottomNav.tsx` 通过 `HIDE_NAV_PREFIXES` 处理。
8. **服务器 `.env.prod` 易丢** — 历史踩过：编辑/重建后 AI_GATEWAY_API_KEY 不见了只剩 `COOKIE_SECURE=false`。容器看似 healthy 但所有 AI 调用静默 fallback "AI 卡了一下"。每次 deploy 后必须 `docker compose exec qingyun env | grep AI_GATEWAY_API_KEY` 验一遍非空。完整 env 模板见仓库 `.env.prod.example`。
9. **AI 超时 30s 太紧** — 八字/梅花长 prompt 经常 25s+，必须 `AI_TIMEOUT_MS=60000` 起步。30s 会以 30s 整命中 abort，前端落到 fallback 文案，看上去像 AI 报错实则超时。
10. **shadcn Select trigger 关闭时显示 raw value** — 当 SelectItem value（如 `"3"`、`"unknown"`）跟 children 文本（如 `"寅时 (03:00-05:00)"`）不一致，关闭状态会显示 `"3"`、`"unknown"`。修法：trigger 里不用 `<SelectValue>`，自己用 `<span>{computedLabel}</span>` 算文本。见 `components/onboarding/DatePicker.tsx` 的 `hourTriggerLabel`。
11. **流式输出被 React 18 batching 合到一帧** — `for await` 同 microtask 内多次 `setState(streamingText)` 会合并成一次 commit，UI 上是"5 秒空白后整段砸出"。修法：用 `requestAnimationFrame` 节流，每帧 1 次 setState；finally 时 `cancelAnimationFrame` 防止流式气泡复活。见 `app/chat/_components/ChatWindow.tsx`。
12. **DatePicker 历法切换** — `calendarType` 不能只塞在 `DatePickerValue` 里，否则 value 为 null 时切换被吃掉。修法：组件内部 `useState<CalendarType>` 维护 `pickedCalendar`，与 value 解耦。
13. **服务器 ~/occult 不是 git repo，patch 上下文易飘** — 每次 `git apply` 失败时，直接 `scp` 整个文件覆盖更稳：`scp -i $KEY <local-file> ubuntu@43.129.186.82:~/occult/<path>`，再 build --no-cache。
14. **bazi/meihua SSE cancel 必须 abort 上游** — reasoning enabled 路径每次 ~30k token，用户关页 AI 仍跑完是真烧钱。`app/api/divination/{bazi,meihua}/route.ts` 的 ReadableStream 加了 `cancel()` → `ac.abort()` → 透到 `chat({ abortSignal })`，client.ts catch AbortError 直接 throw 而非吞 fallback 文案。
15. **AI 网关 backup 切换仅 non-stream 路径生效** — `lib/ai/client.ts` 在 stream=false 时 primary 失败自动 retry backup（`AI_GATEWAY_BACKUP_*`）；流式路径因为 SSE 半途切换复杂度高，先不做主备。注意：backup base/key 任一为空则忽略，不会瞎 retry。
16. **周/月运势 reading SWR** — `fortunes_weekly` / `fortunes_monthly` 也加了 `reading_source` 列（migration 0003），同 day 的 SWR 模式：先存 fallback，进详情页 `<ReadingAutoRegen scope="week|month">` 触发 `/api/fortune/{weekly,monthly}/regenerate` AI 升级。`onConflictDoUpdate` 时 reading + reading_source 不在 update 集合，避免 ai 版被 fallback 重算覆盖。
17. **Sentry 仅在 DSN 存在时动态加载** — `lib/observability/sentry.ts` `initSentry()` 用 dynamic import，dev 没 DSN 时连 SDK 都不进 bundle。客户端 `instrumentation-client.ts` 用 `NEXT_PUBLIC_SENTRY_DSN`（必须 NEXT_PUBLIC_ 前缀才能进浏览器）。`app/global-error.tsx` 在 React error 边界手动 captureException。
18. **Cron 任务挂在 instrumentation 注册** — Next 16 自动跑 `instrumentation.ts → register()`，HMR 会重复触发 `registerJob`，所以 try/catch "already registered" 静默跳过。jobs 用 dynamic import 避免 edge runtime 分析时拉 better-sqlite3。
19. **PIPL 注销账号靠 cascade** — `app/api/me/account/delete/route.ts` 一句 `DELETE FROM users WHERE id=?`，schema 上所有相关表 `ON DELETE CASCADE` 自动清理 profiles / wechat_bind / phone_bind / conversations / messages / fortunes_*。然后服务端清 cookie，前端 router.replace。
14. **AI 思考链泄露到 SSE / 历史** — `thinking: enabled`（八字/梅花）偶尔会把 `<think>...</think>` 漏到 textStream。`lib/ai/output-sanitizer.ts` 写库前剥；客户端 `app/chat/_components/use-chat-stream.ts` 用 `consumeStreamChunk` 跨 chunk 状态机剥（防 `<thi` + `nk>` 拼出来才识别）。详见 `docs/superpowers/specs/2026-05-06-launch-readiness.md`。
15. **OTP / rate-limit / 短期缓存** — 全部走 `lib/cache/kv-store.ts` 的 `KVStore` 接口，单进程默认 `InProcessKVStore`（Map）；上线多副本必须切 Redis（接口已定，`createKVStore({ kind: "redis" })` 实现 TODO）。`MOCK_OTP_BYPASS` 在 prod 强制忽略（`lib/auth/phone-otp.ts` 内置）。
16. **SMS 走 SmsProvider** — `lib/sms/{provider,mock,tencent}.ts`。线上 env `SMS_PROVIDER=tencent` + `TENCENT_SMS_*` 五件套（SECRET_ID/KEY/SDK_APP_ID/SIGN_NAME/TEMPLATE_ID_OTP）。dev 默认 mock 打 console。
17. **八字 / 梅花 排盘** — `lib/divination-providers/{bazi,meihua}.ts` Strategy。当前 local 跑本地 `lib/bazi` + `lib/divination/meihua-v2`；env `BAZI_PROVIDER=api` / `MEIHUA_PROVIDER=api` 切第三方（占位待实现）。算法库公开 API 见 `lib/bazi/index.ts` + `lib/divination/index.ts`（带 README）。
18. **小程序登录** — `app/api/auth/wechat-mini` 走 `wx.login` → `code2Session` → 优先 `unionid` 合并 H5 老账号 → 签 JWT 返。`proxy.ts` 同时认 cookie + `Authorization: Bearer <jwt>`。小程序前端骨架在 `miniprogram/`，`utils/api.js` 自动带 Bearer，401 自愈重 login。
19. **Cron 实调度** — `lib/cron/index.ts` 用 node-cron。env `CRON_ENABLED=1` 才真调度（prod 默认开 / dev 默认关）。同名 job 并发 guard，error 不让进程崩。

## 4. 文档导航

- 设计 spec：`docs/superpowers/specs/2026-04-24-qingyun-ai-design.md`
- 实施计划：`docs/superpowers/plans/2026-04-24-qingyun-ai-{p1-skeleton,p2-features}.md`
- 运势 reading AI 化：`docs/superpowers/specs/2026-05-04-fortune-reading-ai-mcp.md`
- 上线就绪化（KVStore/SMS/Provider/JWT/小程序）：`docs/superpowers/specs/2026-05-06-launch-readiness.md`
- 业务流程对照：`产品设计以及需求管理/开发实现业务逻辑以及流程.md`
- 算法库说明：`lib/bazi/README.md` + `lib/divination/README.md`
- 小程序：`miniprogram/README.md`
- 命令速查：`OPERATIONS.md`
- coin 项目（同服务器邻居）：`~/Desktop/workspace/coin/.claude/skills/deploy/SKILL.md` + `coin/CLAUDE.md`

## 5. 给 Claude 的协作约定

- 部署相关问题先看本文件 §2 §3，再去翻 coin 项目对照。
- 改 schema 时同步检查 `app/chat/_components/ChatWindow.tsx` 的 fetch body 是否传 `null`。
- UI 改完跑 `pnpm typecheck && pnpm test` 才说"完成"。
- 推 patch 到服务器后必须 `--no-cache` 重建（否则 Docker 复用旧 layer 看似成功实则未生效）。
