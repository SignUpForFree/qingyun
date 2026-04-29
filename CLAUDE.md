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
| User | `ubuntu` |
| Key | `/Users/edy/Downloads/renl.pem`（必须 `chmod 600`） |
| OS | Ubuntu 24.04 LTS（hostname `VM-0-10-ubuntu`） |
| Repo dir | `~/occult`（**不是** git repo，是 scp 推上去的，所以 `git pull` 不能用，用 `git apply` 打 patch 或 rsync 同步） |
| Container | `qingyun-ai`（`docker compose ... ps`），镜像 `occult-qingyun:latest` |
| 端口 | `0.0.0.0:3000:3000` |
| 数据卷 | `~/occult/data:/app/data`（uid=1001，host 是 ubuntu uid=1000，必须 `sudo chown -R 1001:1001 ~/occult/data`） |
| 公网 | http://192.144.226.27:3000 |

### 一行 SSH

```bash
ssh -i /Users/edy/Downloads/renl.pem -o StrictHostKeyChecking=accept-new ubuntu@192.144.226.27 '<cmd>'
```

### 推改动 + 重建（最常用流程）

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

## 4. 文档导航

- 设计 spec：`docs/superpowers/specs/2026-04-24-qingyun-ai-design.md`
- 实施计划：`docs/superpowers/plans/2026-04-24-qingyun-ai-{p1-skeleton,p2-features}.md`
- coin 项目（同服务器邻居）：`~/Desktop/workspace/coin/.claude/skills/deploy/SKILL.md` + `coin/CLAUDE.md`

## 5. 给 Claude 的协作约定

- 部署相关问题先看本文件 §2 §3，再去翻 coin 项目对照。
- 改 schema 时同步检查 `app/chat/_components/ChatWindow.tsx` 的 fetch body 是否传 `null`。
- UI 改完跑 `pnpm typecheck && pnpm test` 才说"完成"。
- 推 patch 到服务器后必须 `--no-cache` 重建（否则 Docker 复用旧 layer 看似成功实则未生效）。
