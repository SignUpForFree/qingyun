# 福小运 · 全量实现 V2.0 设计 spec

> **状态**：草稿 v1（2026-04-27 brainstorming 完成）
> **基础**：完全推翻 V1.0 MVP，按需求文档 24 张原型图 1:1 重做，托管到微信服务号 H5
> **节奏**：单人 90 天 + 10 天 buffer = 100 天，6 个里程碑（M1-M6）
> **范围**：P0 + P1（60-85 天纯开发），不含塔罗 / 语音 ASR / 会员订阅 / 客服消息 / 微信支付（P2 砍）

---

## 0. 决策总览（11 项已锁）

| # | 决策点 | 选择 | 影响 |
|---|---|---|---|
| 1 | 范围 | A1 全量文档 1:1 | 80-100 工作日预算 |
| 2 | 平台形态 | B2-b H5 托管在微信服务号 | OAuth 网页授权登录，避开小程序合规风险 |
| 3 | 资质 | 营业执照 + 域名 + ICP + 服务号都有，M0 进行中 | 可立即开始本地开发 |
| 4 | 数据迁移 | wipe + 重建，不写迁移脚本 | 节省 3-5 天 |
| 5 | 公众号类型 | 服务号（snsapi_userinfo + 模板消息推送） | 多花 300/年，换 retention 杀手锏 |
| 6 | 后端架构 | Next.js + SQLite + node-cron 单容器（A 方案） | +0 天，代价是单实例瓶颈，量起后要重做 |
| 7 | 多档案模型 | A3：默认档案全绑业务，非默认仅作八字/梅花输入源 | A1（+5-7d）和 A2（轻）的折中 |
| 8 | 视觉风格 | C：素笺骨架保留，仪式感页面（抽签报告/签文图）局部特化 | +3-5 天，避免重做 30+ 组件 |
| 9 | 页面布局 | 严格按原型 1:1（字段位置/按钮/交互流） | 与视觉策略 C 不冲突 |
| 10 | 范围 cut | B：P0 + P1（60-85 天），P2 全砍 | 留 1-1.5 月 buffer |
| 11 | 节奏 | A：90 + 10 buffer = 100 天，做完为止无外部 deadline | 每周里程碑 review |

**附加锁定**（brainstorming 期间次要决策）：

- **64 卦字典数据来源**：B 方案 = 开源 json + 手修 20%，工时 ≈ 3 天
- **8 lucky attributes 不靠 AI 生成**：查找表 + 五行规则
- **资源策略**：全部 SVG 代码自画 + CSS gradient，零外部下载
- **AI 网关**：继续 ofox / deepseek-v4-pro，M6 接备用网关开关
- **测试覆盖率**：维持 V1.0 现状 80%+
- **数据备份 / 回滚**：MVP 阶段不做（用户全是测试数据），TODO 上线后真有用户必须补

---

## 1. 信息架构 + 路由表

### 1.1 用户进入路径

```
微信用户
   ├─ 关注服务号"福小运"
   ├─ 点击底部菜单 "立即体验"
   ↓
[微信内置浏览器打开 H5]
https://qingyun.{domain}.com/
   ↓
检查 cookie:
   ├─ 已登录 + 已绑微信 → /  (首页)
   ├─ 已登录 未绑微信 → /me/wechat-bind (绑定提示)
   └─ 未登录 → 自动 302 → /api/auth/wechat (启动 OAuth)
                            ↓
                   微信跳 callback (拿 openid + 头像 + 昵称)
                            ↓
                   /api/auth/wechat/callback
                   - 创建/查 user
                   - 写 wechat_bind 表 (openid + unionid)
                   - 自动创建默认 profile（昵称从微信，其他字段空）
                   - set httpOnly cookie
                            ↓
                   首次登录 → /onboarding 引导补齐
                   非首次 → /  (首页)
```

### 1.2 路由表（13 个页面 + 1 个回调）

| Path | 来源原型 | 说明 | 鉴权 |
|---|---|---|---|
| `/` | image2 | 首页：今日运势卡 + 7 维度条 + 8 lucky 属性 + 4 launchers + bottom nav | 必登 |
| `/chat` | image7 | AI 问答 welcome 页：4 launcher cards + 4 chips + 输入框 | 必登 |
| `/chat?cid=xxx` | - | 已存在的会话 | 必登 |
| `/chat?cid=xxx&open=history` | image8 | 同上，左抽屉打开（drawer 内嵌不独立路由） | 必登 |
| `/me` | image21 | 我的：头像 + 昵称 + 档案信息 ➜ + 编辑 + 退出 | 必登 |
| `/me/edit` | image22 | 编辑个人信息：头像 + 关联手机 + 昵称 + 性别 + 出生 + 现居 + 退出 | 必登 |
| `/me/phone/verify` | image23 | 换绑手机 step1：验证当前手机 | 必登 |
| `/me/phone/new` | image24 | 换绑手机 step2：输入新号 + 确认 | 必登 |
| `/me/profiles` | image4 | 档案列表：N 条卡片 + ☑ + ✏️ + ❌ + "添加" + "确认" | 必登 |
| `/me/profiles/new` | image5 | 添加档案表单 | 必登 |
| `/me/profiles/[id]/edit` | image5 | 编辑档案表单 | 必登 |
| `/fortune` | image3 | 每日运势详情：日/周/月 switcher + 7 天日期带 + 7 维度详细解读 + 深入追问 | 必登 |
| `/onboarding` | - | 新用户引导（首次登录后引导填档案） | 必登 |
| `/api/auth/wechat/callback` | - | OAuth 回调（无 UI） | 公开 |

**关键设计**：抽签 / 八字 / 解梦 / 梅花 全部走 `/chat` 路径——通过对话卡片驱动，没有独立 URL。

### 1.3 微信服务号菜单结构（3 列 × 5 项）

```
[ 立即体验 ]    [ 今日运势 ]    [ 我的 ]
   ├ 进入首页    ├ 当日运势详情    ├ 个人信息
   ├ 抽个签      ├ 历史运势        └ 客服
   ├ AI 解梦                       
   ├ AI 八字
   └ AI 测算
```

每个菜单项指向 H5 路径（公众平台后台配置）：

- `立即体验.进入首页` → `https://qingyun.xxx.com/`
- `立即体验.抽个签` → `/chat?intent=divination`
- `立即体验.AI 解梦` → `/chat?intent=dream`
- `立即体验.AI 八字` → `/chat?intent=bazi`
- `立即体验.AI 测算` → `/chat?intent=meihua`
- `今日运势.当日运势详情` → `/fortune`
- `我的.个人信息` → `/me`

**`/chat?intent=xxx` 是新增 query**：检测到时 ChatWindow 自动 dispatch 一条 system pre-message → 触发对应引导卡，跳过 keyword/LLM intent classifier。

### 1.4 鉴权层

`middleware.ts`（V1.0 已有，需扩展）：

- **公开**：`/api/auth/wechat*`、`/api/healthz`、`/api/wechat/template-message`（仅服务端内部触发）
- **必登**：所有其他路径
- 检查：`session_id` cookie → 查 `users.id` → 同时检查 `wechat_bind` 是否绑定（H5 in 公众号场景必须绑）
- 失败：API 返 401 JSON / 页面 302 → /api/auth/wechat

**顶部右上角"☰"按钮**（image8 显示）：

- 在 `/chat` 页面打开"历史会话抽屉"（drawer，URL `?open=history`）
- 在 `/`、`/me` 页面隐藏（避免污染主流）

### 1.5 关键交互的 URL 方案

| 用户行为 | URL 变化 |
|---|---|
| 首页点"抽签"launcher | `/chat?intent=divination` → 自动 dispatch 引导卡 |
| 首页点"今日运势"卡 | `/fortune?date=today` |
| 抽签解读完点"立即解读" | 在 chat 内消息流内追加 → URL 不变 |
| 抽签解读点"保存" | 调微信 JSSDK `previewImage` 保存到相册 → URL 不变 |
| 我的页点档案管理 | `/me/profiles` |
| 切换历史档案 | localStorage `currentProfileId` 改 → 当前 chat URL 不变，下条消息生效 |

---

## 2. 数据模型（SQL Schema）

### 2.1 设计原则

- **wipe + 重建** —— 不写迁移脚本，新 schema 一次到位
- **SQLite 单文件** —— better-sqlite3，部署在 `~/occult/data/qingyun.db`
- **多档案 A3** —— `profiles.is_default = true` 唯一约束
- **A3 不缓存非默认档案的运势** —— 只默认档案有 daily/weekly/monthly fortune 行
- **解读历史不单独建表** —— 从 `messages where metadata.ui in (...)` 反查
- 所有 PK 用 `text`（uuid v4），`created_at` 用 ISO 8601 文本

### 2.2 14 张表（13 主表 + 1 微信 token 单例）

#### 核心账户体系（4 张）

```sql
-- 1. 用户主表
CREATE TABLE users (
  id              text PRIMARY KEY,
  created_at      text NOT NULL,
  updated_at      text NOT NULL,
  last_seen_at    text,
  privacy_accepted_at text
);

-- 2. 微信绑定（H5 in 服务号必备）
CREATE TABLE wechat_bind (
  user_id         text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  openid          text NOT NULL UNIQUE,
  unionid         text,
  nickname        text,
  avatar_url      text,
  raw_userinfo    text,
  bound_at        text NOT NULL,
  last_synced_at  text,
  last_oa_error   text
);
CREATE INDEX idx_wechat_bind_openid ON wechat_bind(openid);
CREATE INDEX idx_wechat_bind_unionid ON wechat_bind(unionid);

-- 3. 手机号绑定（image22-24 流程）
CREATE TABLE phone_bind (
  user_id         text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone_e164      text NOT NULL UNIQUE,
  bound_at        text NOT NULL,
  last_changed_at text
);
CREATE INDEX idx_phone_bind_phone ON phone_bind(phone_e164);

-- 4. 档案（A3：1 user → N profiles，1 default）
CREATE TABLE profiles (
  id                text PRIMARY KEY,
  user_id           text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_default        integer NOT NULL DEFAULT 0,
  nickname          text NOT NULL,
  avatar_url        text,
  gender            text NOT NULL CHECK (gender IN ('male','female','other')),
  birth_date        text NOT NULL,
  birth_time        text NOT NULL,
  birth_calendar    text NOT NULL DEFAULT 'solar' CHECK (birth_calendar IN ('solar','lunar')),
  birth_place       text NOT NULL,
  current_address   text,
  bazi_pillars      text,
  created_at        text NOT NULL,
  updated_at        text NOT NULL
);
CREATE INDEX idx_profiles_user_default ON profiles(user_id, is_default DESC);
-- 业务约束（应用层）：每个 user_id 至多 1 行 is_default = 1
```

#### 对话引擎（2 张）

```sql
-- 5. 会话
CREATE TABLE conversations (
  id                  text PRIMARY KEY,
  user_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id          text REFERENCES profiles(id) ON DELETE SET NULL,
  title               text NOT NULL,
  summary             text,
  summary_msg_count   integer DEFAULT 0,
  last_intent         text,
  last_message_at     text,
  created_at          text NOT NULL
);
CREATE INDEX idx_conversations_user_time ON conversations(user_id, last_message_at DESC);

-- 6. 消息
CREATE TABLE messages (
  id                  text PRIMARY KEY,
  conversation_id     text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                text NOT NULL CHECK (role IN ('user','assistant','system')),
  content             text NOT NULL,
  intent              text,
  metadata            text,
  profile_id_used     text REFERENCES profiles(id) ON DELETE SET NULL,
  tokens_used         integer DEFAULT 0,
  created_at          text NOT NULL
);
CREATE INDEX idx_messages_conv_time ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_intent_time ON messages(intent, created_at);

-- FTS5 全文搜索（P1 历史搜索用）
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);
-- trigger: insert/update/delete messages 同步到 messages_fts
```

#### 运势数据（3 张，仅默认档案缓存）

```sql
-- 7. 每日运势
CREATE TABLE fortunes_daily (
  profile_id     text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date           text NOT NULL,
  overall        integer NOT NULL CHECK (overall BETWEEN 0 AND 100),
  scores         text NOT NULL,
  one_liner      text,
  attributes     text NOT NULL,
  reading        text NOT NULL,
  generated_at   text NOT NULL,
  PRIMARY KEY (profile_id, date)
);

-- 8. 每周运势
CREATE TABLE fortunes_weekly (
  profile_id     text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start     text NOT NULL,
  overall        integer,
  scores         text,
  one_liner      text,
  reading        text,
  generated_at   text NOT NULL,
  PRIMARY KEY (profile_id, week_start)
);

-- 9. 每月运势
CREATE TABLE fortunes_monthly (
  profile_id     text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month          text NOT NULL,
  overall        integer,
  scores         text,
  one_liner      text,
  reading        text,
  generated_at   text NOT NULL,
  PRIMARY KEY (profile_id, month)
);
```

#### 静态字典（2 张，seed 后只读）

```sql
-- 10. 100 签
CREATE TABLE slips (
  number             integer PRIMARY KEY,
  level              text NOT NULL,
  title              text NOT NULL,
  poem               text NOT NULL,
  default_reading    text NOT NULL,
  category_readings  text NOT NULL
);

-- 11. 64 卦字典（P1，梅花 V2 用）
CREATE TABLE gua64 (
  number          integer PRIMARY KEY,
  name            text NOT NULL,
  upper           text NOT NULL,
  lower           text NOT NULL,
  pan_ci          text NOT NULL,
  yao_ci          text NOT NULL
);
```

#### 运维（3 张）

```sql
-- 12. cron 执行日志
CREATE TABLE cron_runs (
  id              text PRIMARY KEY,
  task_name       text NOT NULL,
  started_at      text NOT NULL,
  finished_at     text,
  status          text NOT NULL CHECK (status IN ('running','success','failed')),
  affected_rows   integer,
  error           text
);
CREATE INDEX idx_cron_runs_task_time ON cron_runs(task_name, started_at DESC);

-- 13. 模板消息发送日志
CREATE TABLE wechat_template_log (
  id              text PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id     text NOT NULL,
  template_data   text,
  sent_at         text NOT NULL,
  status          text NOT NULL CHECK (status IN ('queued','sent','failed')),
  raw_response    text
);
CREATE INDEX idx_template_log_user_time ON wechat_template_log(user_id, sent_at DESC);

-- 14. 微信 token 单例缓存
CREATE TABLE wechat_token (
  type        text PRIMARY KEY CHECK (type IN ('access_token', 'jsapi_ticket')),
  value       text NOT NULL,
  expires_at  integer NOT NULL
);
```

### 2.3 关键 schema 决策

1. **删 `divinations` 表**（V1.0 早期可能存在）—— 所有意图历史从 messages 反查
2. **删除策略分两种**：
   - 用户注销 → CASCADE 删 wechat_bind / phone_bind / profiles / conversations / messages / fortunes_*（一键清干净）
   - 删除单个档案 → fortunes_daily/weekly/monthly CASCADE 跟删（运势数据无意义）；conversations.profile_id / messages.profile_id_used 改 SET NULL（保留历史，只是档案归属变空）
3. **profiles.bazi_pillars 缓存** —— 避免每次解八字重新调 lunar-javascript
4. **fortunes_daily 不存外层 ai_text** —— image3 详细解读 7 段在 reading json 里
5. **conversations.profile_id 不强制** —— 仅做关联，用户中途切档案不影响
6. **messages.profile_id_used 才是关键** —— 回溯"这条解读用了哪个档案"
7. **wechat_template_log 单独建表** —— 推送外部副作用必须有日志，便于审计

### 2.4 索引策略

| 查询场景 | 索引 |
|---|---|
| 历史抽屉（按时间倒序列出会话） | `conversations(user_id, last_message_at DESC)` |
| 单会话消息时间线 | `messages(conversation_id, created_at)` |
| "我的抽签历史" | `messages(intent, created_at)` 后过滤 metadata.ui |
| 微信回调查 user | `wechat_bind(openid)` |
| 默认档案查找 | `profiles(user_id, is_default DESC)` |
| 今日运势查 | `fortunes_daily PK (profile_id, date)` |
| cron 状态监控 | `cron_runs(task_name, started_at DESC)` |
| 历史全文搜索 | `messages_fts` (FTS5 unicode61) |

---

## 3. 微信集成

### 3.1 服务号配置（M0 阶段必做）

| 项 | 值 |
|---|---|
| 公众号类型 | 服务号 |
| 主体 | 企业认证（300/年，已选） |
| OAuth scope | `snsapi_userinfo` |
| 业务域名 | `qingyun.{your-domain}.com`（HTTPS） |
| JS 接口安全域名 | 同上 |
| 网页授权域名 | 同上 |
| 模板消息 ID | 申请 2 个：每日运势 / 报告完成通知 |
| 微信支付 | 不申请（P2 砍） |

**M0 必须在服务号后台手动配置的 4 项**：

- 设置 → 公众号设置 → 业务域名 → 添加 `qingyun.{domain}.com`
- 设置 → 公众号设置 → JS 接口安全域名 → 同上
- 设置 → 网页服务 → 网页授权 → 修改授权回调域名 → 同上
- 模板消息 → 从模板库选 2 条，记 template_id 到 `.env.prod`

### 3.2 OAuth 网页授权流程

```
[用户从公众号菜单点 "立即体验"]
       ↓
GET https://qingyun.xxx.com/api/auth/wechat
       ↓
后端构造 redirect URL:
  https://open.weixin.qq.com/connect/oauth2/authorize
    ?appid={WECHAT_APPID}
    &redirect_uri={URL_ENCODED('https://qingyun.xxx.com/api/auth/wechat/callback')}
    &response_type=code
    &scope=snsapi_userinfo
    &state={CSRF_TOKEN_signed_HMAC}
    #wechat_redirect
       ↓
[微信内置浏览器跳到上面 URL]
       ↓
[用户看到"福小运 申请使用以下权限：获取你的昵称、头像"，点同意]
       ↓
[微信回跳]
GET https://qingyun.xxx.com/api/auth/wechat/callback?code=CODE&state=CSRF
       ↓
后端：
  1. 校验 state（HMAC-SHA256 验签 + 时间戳 < 5 min）
  2. 用 code 换 access_token + openid:
     GET https://api.weixin.qq.com/sns/oauth2/access_token
       ?appid=...&secret=...&code=...&grant_type=authorization_code
     → { access_token, openid, unionid?, expires_in: 7200 }
  3. 用 access_token + openid 拉 userinfo:
     GET https://api.weixin.qq.com/sns/userinfo
       ?access_token=...&openid=...&lang=zh_CN
     → { openid, nickname, headimgurl, unionid?, ... }
  4. upsert wechat_bind(openid) → 拿 user_id（首次自动创建 user）
  5. 首次登录 → 自动创建一个默认 profile（昵称用微信昵称，其他字段空）
  6. set httpOnly cookie session_id
  7. 302 → /onboarding (首次) / / (非首次)
```

**关键设计**：

- OAuth 拿到的 `access_token` **不缓存**（一次性，2 小时即过期，专用于一次拉 userinfo）
- 真正缓存的是**接口调用 access_token**（见 3.4）
- `state` 用 HMAC-SHA256 签名 + 时间戳，防 CSRF + 防重放
- 首次登录自动建 default profile，**昵称取自微信，其他字段空**——引导用户去 /onboarding 补齐

### 3.3 JS-SDK 配置（前端保存图片到相册）

```
[前端组件：抽签解读卡的"保存"按钮]
       ↓
点击 → 拉 wx.config:
  GET /api/wechat/jssdk-config?url={current_page_url}
       ↓
后端:
  1. 拿缓存的 jsapi_ticket（见 3.4）
  2. 计算签名 sha1(noncestr=...&timestamp=...&jsapi_ticket=...&url=...)
  3. 返回 { appId, timestamp, nonceStr, signature, jsApiList: ['previewImage','chooseImage'] }
       ↓
前端 wx.config(...) → wx.ready
       ↓
wx.previewImage({ urls: [slipImageUrl] })  -- 用户长按可保存到相册
```

不用 wx.downloadImage 直接存的原因：服务号未必有此权限，previewImage 是稳定路径。

### 3.4 access_token 双层缓存

微信接口调用 access_token 是**全局共享**（每个 appid 一份），24 小时调用上限 2000 次，必须缓存：

```ts
// lib/wechat/token-store.ts

class TokenStore {
  private memCache: { token: string; expiresAt: number } | null = null;

  async get(type: 'access_token' | 'jsapi_ticket'): Promise<string> {
    // 1. 内存缓存命中且未过期 → 返回
    if (this.memCache && Date.now() < this.memCache.expiresAt - 60_000) {
      return this.memCache.token;
    }
    // 2. SQLite 缓存命中
    const row = db.select().from(wechatToken).where(eq(wechatToken.type, type)).get();
    if (row && Date.now() < row.expires_at - 60_000) {
      this.memCache = { token: row.value, expiresAt: row.expires_at };
      return row.value;
    }
    // 3. 调微信刷新（access_token 用 grant_type=client_credential，jsapi_ticket 用 type=jsapi）
    const fresh = await fetchFreshToken(type);
    db.insert(wechatToken).values(fresh).onConflictDoUpdate({...});
    this.memCache = fresh;
    return fresh.value;
  }
}
```

`jsapi_ticket` 同理（也是 7200s 过期，同表不同 type 行）。

### 3.5 模板消息推送（cron）

每日凌晨 0:30 cron 触发：

```ts
// lib/cron/daily-fortune-push.ts

every day at 00:30:
  1. 读所有 active users (last_seen_at within 30 days)
  2. 对每个 user → default profile → 算今天运势 → upsert fortunes_daily
  3. 调微信发模板消息:
     POST https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=...
     {
       touser: openid,
       template_id: WECHAT_TPL_DAILY_FORTUNE,
       url: 'https://qingyun.xxx.com/fortune?date=today',
       data: {
         first: { value: '老王，今天的运势出炉啦', color: '#C49AB6' },
         keyword1: { value: '92 分', color: '#173177' },
         keyword2: { value: '事业、财运双高', color: '#173177' },
         remark: { value: '点击查看 7 维度详细解读 →', color: '#A2A0BC' }
       }
     }
  4. 写 wechat_template_log
  5. 错误处理：errcode 43004 (用户未关注) → 标记 user.last_oa_error，不再推
            errcode 45047 (24h 内重复) → 跳过
```

**第二个模板**（八字/梅花算完后异步推）：
```
data: { first: '你的八字解读已生成', keyword1: '事业方向', remark: '点击进入对话查看完整报告 →' }
url: /chat?cid={conversationId}
```

### 3.6 微信内置浏览器 H5 适配

| 约束 | 处理 |
|---|---|
| iOS 微信不支持 `position: fixed` 在键盘弹起时 | 输入框用 `position: sticky` + `bottom: env(safe-area-inset-bottom)` |
| 微信会缓存 `window.title` 第一次设置 | `useEffect(() => document.title = '...', [])` 失效，改用 `wx.setTitleColor` (iOS) 或重定向 |
| 分享卡片需要 wx.updateAppMessageShareData | JS-SDK 调用 + 服务端签名 |
| 微信不允许打开非业务域名 | 所有外链必须在业务域名内 |
| 微信内 cookie SameSite | 用 `SameSite=Lax` 不要 `None` |
| SSE 长连超过 60s 断流 | 每 25s 发 SSE comment heartbeat (`: ping\n\n`) |

### 3.7 安全 + 合规

1. **AES 加密 access_token + jsapi_ticket** —— SQLite 静默存储，env 里有 master key
2. **OAuth state 用 HMAC** —— `hmacSHA256(timestamp + nonce, env.WECHAT_STATE_SECRET)`，5 分钟过期
3. **rate limit** —— 每 IP 每分钟 30 次 OAuth 调用（防扫号）
4. **退出登录** —— 删 cookie + 调微信 `oauth2/revoke` 撤销 access_token，openid 不删
5. **隐私政策 + 用户协议** —— 服务号网页授权弹窗会显示这两份链接，必须托管 `/legal/privacy` `/legal/terms` 静态页

### 3.8 ENV 新增

```bash
WECHAT_APPID=wx...
WECHAT_APPSECRET=...
WECHAT_STATE_SECRET=base64-32-bytes
WECHAT_AES_KEY=base64-32-bytes
WECHAT_TPL_DAILY_FORTUNE=template-id-1
WECHAT_TPL_REPORT_READY=template-id-2
WECHAT_OA_REDIRECT_URI=https://qingyun.xxx.com/api/auth/wechat/callback
WECHAT_OA_DOMAIN=qingyun.xxx.com
PUBLIC_BASE_URL=https://qingyun.xxx.com
```

### 3.9 故障兜底

| 故障 | 处理 |
|---|---|
| access_token 接口 503 | 重试 3 次，失败用旧 token 兜底，同时报警 |
| OAuth code 已用过 (errcode 40029) | 重定向回 OAuth 入口让用户重走 |
| 模板消息 errcode 43004 用户取关 | DB 标记 last_oa_error，30 天后再尝试 |
| jsapi_ticket 失效 | 强制刷新一次再签名，用户感知不到 |
| 用户清缓存 cookie 没了 | 直接走 OAuth，openid 不变，自动续上原 user_id |

---

## 4. AI 对话路由

### 4.1 设计原则

- **所有意图收敛到 `/chat`** —— 抽签/解梦/八字/梅花没有独立页面
- **对话引擎 = 路由器 + 卡片渲染** —— 后端识别意图 → 写卡片消息（`metadata.ui`）→ 前端 dispatch 到对应组件
- **卡片是哑组件** —— 只汇报"用户做了 X 操作"，不知道 API
- **后端是唯一决策者** —— 状态机由后端 messages 推进
- **流式 SSE 4 类事件**：`meta` / `token` / `card` / `progress` / `done` / `error`

### 4.2 22 个 UI 类型

| 分类 | UI Type | 说明 |
|---|---|---|
| 状态 | `intent_pending` | "正在识别意图…" |
| 状态 | `progress_long_task` | 八字/梅花长 prompt 进度提示 |
| 状态 | `error_card` | 统一错误展示 |
| 引导 | `slip_type_picker` | 抽签 6 类选择 |
| 引导 | `dream_choice` | 解梦快速 vs 精准 |
| 引导 | `bazi_focus_picker` | 八字焦点 6 维度 |
| 引导 | `meihua_method_picker` | 梅花起卦方式 |
| 引导 | `profile_picker` | 八字/梅花前选档案（A3） |
| 引导 | `slip_drawing` | 摇签动画状态 |
| 表单 | `slip_question_input` | 抽签前问题输入 |
| 表单 | `dream_fast_form` | 解梦快速：单 textarea |
| 表单 | `dream_precise_modal_trigger` | 触发解梦精准 modal |
| 表单 | `bazi_quick_form` | 缺档案时快速八字录入 |
| 表单 | `meihua_number_input` | 3 数字 + 问题 |
| 结果 | `slip_image` | 抽签大图（image10 全屏） |
| 结果 | `slip_report` | 抽签解读报告（image11） |
| 结果 | `bazi_result` | 八字解读结果 |
| 结果 | `dream_result_fast` | 解梦快速结果 |
| 结果 | `dream_result_precise` | 解梦精准结果（三视角） |
| 结果 | `meihua_result` | 梅花结果 |
| 静态 | `meihua_intro` | 梅花介绍 |
| 基础 | `text` | 普通文本气泡 |

### 4.3 路由器（/api/chat）

```
POST /api/chat { conversationId?, text, profileIdHint? }
       ↓
1. 校验 + 限流 + 安全词
2. ensureUserId + ensureWeChatBound
3. 建/取 conversation（首次 user message 前 10 字做 title）
4. classifyIntent(text):
   - 优先 ?intent=xxx query 命中 → 直接走该意图（菜单跳转用）
   - 否则关键词层 (lib/ai/intent-keywords.ts)
   - 兜底 LLM 分类（5 类 + 'unknown'）
5. 写 user message + 更新 conversations.last_intent
6. 分流：
   - chat → streamChatReply (SSE token 流)
   - divination → buildSlipFlow → slip_type_picker
   - dream → buildDreamFlow → dream_choice
   - bazi → buildBaziFlow (查 default profile)
   - meihua → buildMeihuaFlow → profile_picker
7. SSE done
8. 异步触发 maybeSummarize
```

### 4.4 各意图流程

#### 抽签 divination

```
user: "我想抽签"
  ↓ classifyIntent → 'divination'
  ↓
assistant card: { ui: 'slip_type_picker', options: [综合运势, 事业学业, 财运, 感情姻缘, 人际贵人, 平安健康] }
  ↓ 用户点 "事业学业"
  ↓ POST /api/divination/qianwen { conversationId, category: '事业学业' }
  ↓
assistant card: { ui: 'slip_question_input' }
  ↓ 用户提交问题
  ↓ POST /api/divination/qianwen { conversationId, category, userQuestion }
  ↓
assistant card: { ui: 'slip_drawing', durationMs: 2000 }  -- 摇签动画 2s
  ↓ 后端同时算签号 (1-100 加权随机 + 用户八字调和)
  ↓
assistant card: { ui: 'slip_image', slipNumber, level, title, poemLines, imageUrl }
  ↓ 用户点 "立即解读"
  ↓ POST /api/divination/qianwen/explain { messageId }
  ↓ AI 流式输出
  ↓
assistant card: { ui: 'slip_report', slipNumber, level, title, poem, dimension, reading, aiInterpretation }
```

#### 解梦 dream

```
user: "我做了梦"
  ↓
assistant card: { ui: 'dream_choice', options: [快速, 精准] }
  ↓ 用户点 "精准"
  ↓ 前端打开 dream_precise_modal（fullscreen modal，4 字段）
  ↓ 用户填完提交
  ↓ POST /api/divination/dream { mode: 'precise', core, emotion, reality?, special? }
  ↓
assistant card: { ui: 'progress_long_task', etaSec: 30 }
  ↓ AI 流式
  ↓
assistant card: { ui: 'dream_result_precise', threeViews: { 心理学, 周公, 现代 }, summary, suggestions }
```

#### 八字 bazi

```
user: "帮我看八字"
  ↓
查 default profile → 有
  ↓
assistant card: { ui: 'profile_picker', profiles: [...] }  -- A3
  ↓ 用户选档案
  ↓ POST /api/divination/bazi { profileId, focusHint? }
  ↓
assistant card: { ui: 'bazi_focus_picker', options: [综合, 事业学业, ...] }
  ↓ 用户点 "事业学业"
  ↓ POST /api/divination/bazi { profileId, focus: '事业学业' }
  ↓
assistant card: { ui: 'progress_long_task' }
  ↓ AI 流式
  ↓
assistant card: { ui: 'bazi_result', chart, focus, aiText }
  ↓ 同时：服务端调微信模板消息推 'report_ready'
```

**八字（缺档案分支）**：

```
查 default profile → 无 / 信息不全
  ↓
assistant card: { ui: 'bazi_quick_form', fields: [gender, birth_time, birth_place] }
  ↓ 用户提交
  ↓ POST /api/divination/bazi { quickFormData }
  ↓ 后端：自动创建 default profile
  ↓ 然后走正常分支
```

#### 梅花 meihua

```
user: "测一下"
  ↓
assistant card: { ui: 'profile_picker' }
  ↓
assistant card: { ui: 'meihua_number_input', fields: [numbers, userQuestion] }
  ↓
assistant card: { ui: 'progress_long_task', etaSec: 35 }
  ↓
AI 流式 → assistant card: { ui: 'meihua_result', ben/hu/bian/guaZhongGua, dongYao, tiYong, yingQi, verdict }
```

### 4.5 多档案在对话中的体现（A3）

- 抽签 / 解梦 / 一般聊天 → **隐式用 default profile**
- 八字 / 梅花 → **显式 profile_picker**
- profile_picker 选项：
  - 默认档案（icon ⭐ + 昵称）
  - 其他档案（按 created_at desc）
  - "添加新档案" → 跳 `/me/profiles/new?return=/chat?cid=xxx`

**消息归档**：

- `messages.profile_id_used` 记录这条八字/梅花消息算的是哪个 profile
- 历史抽屉显示会话时，title 后面带 `· 档案：我妈` 标签

### 4.6 历史会话抽屉（image8）

```
[/chat?cid=xxx]
       ↓
顶部右上角 [☰] 按钮 → setOpen(true)
       ↓
左侧滑出 drawer (300px wide)
       ↓
GET /api/chat/conversations?limit=50&offset=0
       ↓
列出：
  - 当前选中（高亮）
  - 历史按 last_message_at desc 分组（今天 / 昨天 / 7 天内 / 更早）
  - 每条卡片：title + 一行预览 + last_intent 标签 + 时间
  - 点击 → router.push(`/chat?cid=newCid`) → 关闭抽屉
       ↓
顶部 [+ 新对话] → 创建新空 conversation → 跳过去
```

**P1 全文搜索**：

- 抽屉顶部搜索框
- `GET /api/chat/conversations/search?q=xxx`
- SQLite FTS5 (`messages_fts`) 全文搜索 messages.content 反查 conversation_id

### 4.7 摘要器 (memory)

V1.0 已实现，保留：

- `K_RECENT = 6` 最近 6 条原文进 prompt
- `SUMMARY_THRESHOLD = 12` 累计 12 条触发摘要
- `SUMMARY_INTERVAL = 4` 每 4 条新消息累加增量摘要
- 触发时机：API done 后异步 `void maybeSummarize(convId)`
- 摘要 prompt：「请将以下 N 条对话压成 80 字以内，保留：情绪/关键事件/AI 给的核心建议」

**新加**：摘要进 conversation 后，前端 history drawer 的 conversation 预览 = `summary || messages[0].content.slice(0,30)`

### 4.8 SSE 事件协议

```
event: meta
data: { conversationId, intent, source: 'keyword'|'llm'|'query' }

event: token
data: "<chunk>"

event: card
data: { id, role: 'assistant', content, metadata: {...} }

event: progress
data: { stage: 'classifying'|'computing'|'streaming', percent?: 0-100 }

event: done
data: {}

event: error
data: { message, retryable: boolean }
```

### 4.9 错误统一兜底

| 错误 | 前端表现 | 后端处理 |
|---|---|---|
| AI 超时（60s） | error_card "AI 演算超时，请重试" + retry | log + 不写 messages |
| AI 限流 | error_card "今天有点忙，等几分钟" | log + retry-after |
| 用户限流 | error_card "你今天比 AI 还忙，已用 X/Y 条" | 拒绝，限流计数 |
| 内容安全词 | error_card "这个话题暂时聊不动" | guard 拦截，不计费 |
| 网络断 | 顶 banner "连接中断，重连中…" | SSE 自动 reconnect |

---

## 5. 算法 / 能力升级

### 5.1 5 个核心算法模块

| # | 模块 | V1.0 状态 | V2.0 升级 | 优先级 |
|---|---|---|---|---|
| 1 | 每日 7 维度运势 | 5 维度，简单加权 | 7 维度，cron + 用户八字调和 | P0 |
| 2 | 抽签 6 维度 | 已有，固定签号 | 加权随机 + 八字微调 | P0 |
| 3 | 八字 V2 规则引擎 | 简化版（lunar.js + 五行计数） | 完整十神 + 大运 + 流年 + DB 检索 | P1 |
| 4 | 梅花 V2 流程 | 简化版（3 数字 → 卦象） | image18 完整：八字+时间能量场+损益 | P1 |
| 5 | 周 / 月运势 | 无 | 新增 cron + 不同 prompt 维度 | P1 |

### 5.2 维度归一化（关键）

- **首页今日运势 / 周 / 月** = 7 维度：`爱情 / 财富 / 事业 / 学习 / 健康 / 人际 / 心情`
- **抽签** = 6 维度：`综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康`
- **八字焦点** = 6 维度（与抽签同集合）
- **梅花** 不分维度，按用户问题自由解读

**为什么不统一**：

- 首页是日报场景，心情维度独立有助于情感识别
- 抽签是仪式场景，按"事业学业/财运/感情/平安"传统分类
- 强行统一会让某一边语义不对劲

**实现位置**：
- `lib/dimensions/seven.ts` → `DAILY_DIMS`
- `lib/dimensions/six.ts` → `DIVINATION_DIMS`

### 5.3 每日 7 维度运势算法

```ts
// lib/fortune/scorer.ts

function computeDailyFortune(profile, date) {
  const dayPillar = lunar.fromDate(date).getDayInGanZhi();
  const relations = analyzeRelations(profile.bazi_pillars.day, dayPillar);
  
  const scores = {
    爱情: scoreLove(profile, dayPillar),
    财富: scoreWealth(profile, dayPillar),
    事业: scoreCareer(profile, dayPillar),
    学习: scoreStudy(profile, dayPillar),
    健康: scoreHealth(profile, dayPillar),
    人际: scoreSocial(profile, dayPillar),
    心情: scoreMood(profile, dayPillar),
  };
  
  const overall = Math.round(
    scores.爱情 * 0.15 + scores.财富 * 0.20 + scores.事业 * 0.20 +
    scores.学习 * 0.10 + scores.健康 * 0.15 + scores.人际 * 0.10 +
    scores.心情 * 0.10
  );
  
  const attributes = pickAttributes(profile, dayPillar);
  const oneLiner = generateOneLiner(scores, dayPillar);
  const reading = await generateReading(profile, dayPillar, scores);
  
  return { overall, scores, attributes, oneLiner, reading };
}
```

**8 lucky attributes 算法**（不靠 AI 生成）：

| 属性 | 算法 |
|---|---|
| `color` | 命主喜用神五行 → 颜色映射 |
| `direction` | 八卦方位 |
| `hour` | 当日有利时辰（按用神决定） |
| `number` | 1-9（基于河图洛书五行数） |
| `flower` | 14 种花卉库（五行 + 季节） |
| `item` | 24 种随身物 |
| `accessory` | 12 种配饰 |
| `food` | 36 种食物（五行 + 时令） |

实现位置：`lib/fortune/attributes.ts`，包含完整查找表。

**one-liner & reading**：

- one-liner：8 选 1 模板（不调 AI）
- reading：调 AI prompt（系统提示词锁定温柔风格 + 7 段结构），每段 60-80 字
- AI 失败兜底：reading 用本地模板（每维度 5 个候选，按分数段挑）

### 5.4 抽签 6 维度算法

```ts
// lib/divination/slips.ts

function drawSlip(profile, category, userQuestion) {
  // 1. seed 生成（确定性 + 时间噪声）
  const seed = sha256(`${profile.id}:${todayDate}:${userQuestion}:${category}`);
  
  // 2. 加权随机抽签号 1-100
  //    上上(8 签)/上吉(15)/中吉(35)/中平(30)/下下(12) 默认权重
  //    用户八字喜忌微调：用神弱时下下权重 +5%，用神旺时上上权重 +5%
  const weights = adjustWeights(BASE_WEIGHTS, profile);
  const slipNumber = pickWeighted(seed, weights);
  
  // 3. 查 slips 表
  const slip = db.select().from(slips).where(eq(slips.number, slipNumber)).get();
  
  // 4. 取该 category 的解读
  const dimensionReading = slip.category_readings[category];
  
  // 5. AI 二次解读
  const aiInterpretation = await aiInterpret({ slip, userQuestion, profile, category });
  
  return { slipNumber, slip, dimensionReading, aiInterpretation };
}
```

**100 签 seed 数据**：V1.0 已有 100 签 seed 可复用。检查 V1.0 seed 的 6 维度字段是否对齐新 6 维度命名，对得上就复用，对不上批量改。

### 5.5 八字 V2 规则引擎

#### V1.0 vs V2.0

| 项 | V1.0 | V2.0 |
|---|---|---|
| 输入 | gender + 出生时间 + 出生地 | 同 V1.0 |
| 排盘 | lunar.js 排四柱 | 同 V1.0 |
| 五行 | 计数 | 加权（藏干 + 月令旺衰） |
| 十神 | 基础 8 神 | 完整十神 + 神煞表（30+ 项） |
| 大运 | 不算 | 排 8 步大运（每步 10 年） |
| 流年 | 不算 | 当年 + 前后 2 年 流年盘 |
| 喜用神 | 简化（缺补） | 格局判断 + 用神锁定 |
| 解读 | 单条 AI prompt | DB 检索神煞解读 + 提示词叠加 |

#### image18 完整流程

```
1. 用户填表单（gender + 出生时间 + 出生地）
       ↓
2. 排盘 (lunar.js)
       ↓
3. 神煞检索（lib/bazi/shensha-rules.ts，30+ 神煞规则）
       ↓
4. 大运 + 流年（lib/bazi/dayun.ts）
       ↓
5. 格局判断 + 用神锁定（lib/bazi/yong-shen.ts）
       ↓
6. 拼提示词：
   system: 温柔助手 + 锁定输出格式
   context: 命盘 + 神煞列表 + 大运 + 流年 + 用神 + focus
   user: "请按 focus 角度解读，500 字以内"
       ↓
7. AI 流式输出（25-40s）
       ↓
8. 写 messages + 推模板消息
```

#### 神煞规则示例

```ts
// lib/bazi/shensha-rules.ts

const RULES = [
  {
    name: '天乙贵人',
    match: (bazi) => /* 日干甲戊见丑未,乙己见子申,... */,
    interpretation: '一生易得贵人提携，逢凶化吉的能力强',
    category: ['人际贵人', '事业学业'],
  },
  // 30+ 条
];
```

30 条神煞解读 ≈ 90 行代码，比"爬 64 卦字典"工程量小，效果直接。

### 5.6 梅花 V2 流程（image18）

#### V1.0 vs V2.0

| 项 | V1.0 | V2.0 |
|---|---|---|
| 起卦法 | 3 数字（先天数） | 同 V1.0 |
| 卦体 | 本卦 + 互卦 + 变卦 | 加 卦中卦（5 卦合一） |
| 体用 | 基础 | + 生克制化 + 五行旺衰 |
| 应期 | 简单（fast/medium/slow） | + 时辰精度（branchHour） |
| AI prompt | 单层（卦象 + 问题） | 多层叠加：卦象 + 用户八字 + 当时辰能量场 + 五行损益 |

```ts
// lib/divination/meihua-v2.ts

function meihuaV2(profile, numbers, userQuestion) {
  const ben = pickGuaFromNumber(numbers);
  const dongYao = computeDongYao(numbers);
  const hu = computeHuGua(ben);
  const bian = applyDongYao(ben, dongYao);
  const guaZhongGua = computeGuaZhongGua(ben, hu, bian);
  
  const tiYong = analyzeTiYong(ben, dongYao);
  
  const now = new Date();
  const branchHour = getBranchHour(now);
  const timeEnergy = computeTimeEnergy(branchHour, profile.bazi_pillars);
  
  const wuxingBalance = analyzeWuxing(ben, hu, bian, profile);
  const sunyi = computeSunYi(wuxingBalance, profile.yong_shen);
  
  const yingQi = computeYingQi(dongYao, branchHour);
  
  const prompt = buildMeihuaPrompt({
    ben, hu, bian, guaZhongGua, dongYao, tiYong,
    profile, timeEnergy, sunyi, yingQi, userQuestion,
  });
  
  return aiStream(prompt);
}
```

**64 卦字典数据**：B 方案 = 找开源 json + 手修 20%，工时 ≈ 3 天。

### 5.7 周 / 月运势 cron

```ts
// lib/cron/weekly-fortune.ts
每周一 01:00:
  for each active user:
    取 default profile
    算未来 7 天的"每日运势"，求平均
    生成 weekly summary（AI prompt 60-80 字 + 7 维度建议）
    upsert fortunes_weekly

// lib/cron/monthly-fortune.ts
每月 1 日 01:30: 类似
```

**前端**（image3 日/周/月切换器）：

- "日"：read fortunes_daily
- "周"：read fortunes_weekly（按当前选中日期所在周）
- "月"：read fortunes_monthly（按当前选中日期所在月）
- 找不到 → 触发后端按需计算（懒加载）

### 5.8 prompt 工程关键约定

```
lib/ai/prompts/

├── system-base.ts        — 基础人设：温柔陪伴 + 禁词列表
├── chat-prompt.ts        — chat 意图，简短回复
├── slip-interpret.ts     — 抽签解读
├── bazi-interpret.ts     — 八字解读：500 字以内
├── meihua-interpret.ts   — 梅花解读：600 字以内
├── dream-fast.ts         — 解梦快速：100 字以内
├── dream-precise.ts      — 解梦精准：三视角 → 400 字以内
└── fortune-reading.ts    — 每日运势 7 段解读 → 每段 60-80 字
```

**结构化输出**：

- 八字 / 梅花用 JSON schema 输出（避免漏字段）
- 解梦 / 抽签用 markdown 标题分段
- chat 自由输出

### 5.9 token 预算 + 超时

| 意图 | input | output | 实测耗时 | 超时 |
|---|---|---|---|---|
| chat | 500-2000 | 200-400 | 3-8s | 15s |
| 抽签解读 | 1500 | 300-500 | 5-10s | 20s |
| 解梦快速 | 800 | 100-200 | 3-6s | 15s |
| 解梦精准 | 2000 | 400-600 | 8-15s | 25s |
| 八字解读 | 3000-4500 | 500-800 | 20-40s | 60s |
| 梅花解读 | 3500-5000 | 600-900 | 25-40s | 60s |
| 日运势 | 1500 | 400-600 | 6-12s | 20s |

全局：`AI_TIMEOUT_MS=60000`（V1.0 已踩坑），分场景再 wrap 局部超时。

### 5.10 限流策略

| 场景 | 限制 |
|---|---|
| 单用户 /api/chat | 30/h |
| 单用户 八字 / 梅花 | 5/h |
| 单用户 抽签 | 10/h |
| 单用户 解梦 | 10/h |
| 全局 AI 调用 | 1000/h |
| 模板消息推送 | 单用户 1/day |

---

## 6. 关键页面 / 组件清单

### 6.1 11 个页面 × 视觉特化

| Page | 视觉风格 | 主要组件 | 数据接入 |
|---|---|---|---|
| `/` 首页 | 素笺骨架 | `<DailyFortuneCardV2>` + `<LauncherGrid>` + `<BottomNav>` | GET `/api/fortune?date=today` |
| `/fortune` 运势详情 | 素笺骨架 | `<DayWeekMonthSwitcher>` + `<DateRangeStrip>` + `<DimensionDetailCards>` + `<DeepAskButton>` | GET `/api/fortune?scope=daily\|weekly\|monthly&date=` |
| `/chat` 对话 | 素笺骨架 | `<ChatWindow>` + `<MessageList>` + `<ChatInput>` + `<HistoryDrawer>` + `<DreamPreciseModal>` | SSE `/api/chat`, GET `/api/chat/conversations` |
| `/me` 我的 | 素笺骨架 | `<ProfileSummaryCard>` + `<MeMenu>` + `<LogoutButton>` | GET `/api/me` |
| `/me/edit` 编辑信息 | 素笺骨架 | `<AvatarPicker>` + `<PhoneBindingRow>` + `<EditableFieldGroup>` | GET/PUT `/api/me/profile` |
| `/me/phone/verify` | 素笺骨架 | `<PhoneCodeInput>` + `<SendCodeButton>` | POST `/api/me/phone/verify` |
| `/me/phone/new` | 素笺骨架 | `<PhoneInput>` + `<NewPhoneCodeInput>` | POST `/api/me/phone/change` |
| `/me/profiles` 档案列表 | 素笺骨架 | `<ProfileCardList>` + `<AddProfileButton>` + `<ConfirmFooter>` | GET/PUT `/api/me/profiles` |
| `/me/profiles/new` | 素笺骨架 | `<ProfileForm>` | POST `/api/me/profiles` |
| `/me/profiles/[id]/edit` | 素笺骨架 | `<ProfileForm>` 预填 | PUT `/api/me/profiles/[id]` |
| `/onboarding` 新用户引导 | 素笺骨架 + 仪式感 | `<OnboardWizard>` 3 步 | POST `/api/me/profile` |

### 6.2 抽签报告是消息内嵌不是独立页

抽签解读流（image10/image11）**不是独立 URL**，而是 `/chat` 内的消息卡片：

- `slip_image` → 全屏占位（消息流内向下滚），点"立即解读"触发 SSE
- `slip_report` → 解读完成的最终消息卡

特殊视觉处理（C 方案的"仪式感特化"）：

- `slip_image` 卡片背景 = 木纹 + 红印章 + 宣纸纹理
- `slip_report` 卡片标题用书法字体（手写感，CSS `@font-face`）
- 其他 chat 消息保持素笺基线

### 6.3 新增组件清单（30+ 个）

#### 布局 / 通用（保留 V1.0 + 微调）

1. `<AppShell>`（V1.0，加 `?intent=` query 处理）
2. `<AppHeader>`（V1.0，加右上角 ☰ 按钮）
3. `<BottomNav>`（V1.0，3 tab，HIDE_NAV_PREFIXES 已处理 chat）

#### 卡片基础（保留 V1.0）

4. `<GlassCard>`、`<Sparkle>`、`<Divider>`、`<WatercolorDot>`

#### 首页 + 运势（重做）

8. `<DailyFortuneCardV2>` — 大改 V1.0：5→7 维度、attributes 重新映射、问候语 "哈喽，{nickname} ✨"
9. `<ScoreRing>`（V1.0 保留）
10. `<DimensionBars7>` — 7 维度水平条
11. `<AttributesGrid8>` — 重做：8 lucky attributes
12. `<LauncherGrid>` — 4 launchers
13. `<DayWeekMonthSwitcher>` — 顶部 3 段控件
14. `<DateRangeStrip>` — 7 天日期带（左右滑动）
15. `<DimensionDetailCards>` — 7 维度详细解读卡片
16. `<DeepAskButton>` — "深入追问 →"

#### 对话引擎（保留 V1.0 骨架，扩展）

17. `<ChatWindow>` — 加 `?intent=` 处理 + drawer 状态 + modal trigger
18. `<MessageBubble>` — 22 ui 类型 dispatch
19. `<ChatInput>` — 加 quick chips（image7 底部 4 chip）
20. `<MessageList>`（V1.0）
21. `<HistoryDrawer>` — 新组件（image8）
22. `<ProfileSwitcher>` — 新组件（顶部固定 / 多档案场景）
23. `<DreamPreciseModal>` — 新组件，fullscreen modal，4 字段
24. `<ProgressLongTaskCard>` — 新组件，进度条 + ETA + 取消按钮
25. `<ShakeSlipAnim>` — 新组件，2s 摇签动画
26. `<SlipImageFullscreen>` — 新组件，image10 全屏大图
27. `<SlipReportCard>` — 新组件，image11 解读报告
28. `<ErrorCard>` — 新组件，统一错误展示

#### 表单 / 引导（保留 + 扩展）

29. `<ChoiceCard>`（V1.0）
30. `<FormCard>`（V1.0）
31. `<DatePicker>` — V1.0，已踩历法切换 + 时辰显示坑，保留逻辑
32. `<HourSelector>` — V1.0 已修
33. `<AvatarPicker>` — 新组件，6 张默认头像 + 上传
34. `<CurrentAddressPicker>` — 新组件，3 级联动（省/市/区）
35. `<PhoneInput>` — 新组件
36. `<PhoneCodeInput>` — 新组件

#### 我的 / 档案（重做）

37. `<ProfileSummaryCard>` — image21 头像 + 昵称 + 出生 + ➜
38. `<MeMenu>` — image21 列表项菜单
39. `<ProfileForm>` — image5 完整表单（image22 复用）
40. `<ProfileCardList>` — image4 多档案管理
41. `<PhoneBindingRow>` — image22 关联手机号显示行

#### 微信集成

42. `<WeChatShareButton>` — P1 抽签报告分享
43. `<WeChatSaveImage>` — previewImage 保存到相册

### 6.4 视觉特化清单（C 方案 4 个组件）

| 组件 | 特化 |
|---|---|
| `<SlipImageFullscreen>` | 木纹背景 + 红印章 + 落款书法字 |
| `<SlipReportCard>` | 标题书法字（Ma Shan Zheng）+ 米黄底 |
| `<ProgressLongTaskCard>` 八字/梅花专版 | 卦象 SVG + 缓慢旋转 + 古铜金渐变 |
| `<DreamPreciseModal>` | 紫蓝夜空渐变 + 月亮 SVG |

工程量：每个特化组件 ≈ 4-6h，合计 16-24h。

### 6.5 设计 token 增量

```css
/* 仪式感页面专用 */
--color-ritual-wood: #8B6F47;
--color-ritual-paper: #F5E8C8;
--color-ritual-seal: #B83A3A;
--color-ritual-gold: #C9A961;

/* 服务号风 */
--color-wechat-green: #07C160;

/* 解梦特化 */
--color-dream-night: #1B1B3A;
--color-dream-moonlight: #E8E4FF;
```

V1.0 紫粉蓝色板保留全部不动。

### 6.6 字体

- V1.0：思源宋体 / 系统衬线
- 新加：`Ma Shan Zheng`（Google Fonts CDN）— 抽签报告标题
- 新加：`Long Cang`（Google Fonts CDN）— 落款

子集化只引中文常用字 3000 字。

### 6.7 资源策略锁定

**全部 SVG 代码自画 + CSS gradient**，零外部下载：

- 18 个功能图标（launcher × 4 / category × 6 / attribute × 8）= 简洁线条风 SVG（素笺色板 + 紫粉蓝渐变）
- 4 个仪式感资源（印章 / 木纹 / 月亮 / 卦象）= SVG + CSS gradient 模拟
- emoji 仅限气泡内联表情（✨ / 🎴 等）

---

## 7. 部署 / DevOps

### 7.1 M0 准备阶段（5-10 工作日，进行中）

| # | 任务 | 必需 | 周期 | 状态 |
|---|---|---|---|---|
| 1 | 营业执照 | 是 | - | ✅ |
| 2 | 域名 `qingyun.{xxx}.com` 注册 | 是 | 立即 | 进行中 |
| 3 | ICP 备案 | 是 | 7-20 天 | 进行中 |
| 4 | 服务号申请 + 认证 | 是 | 申请 1 天 + 认证 7-15 天 | 进行中 |
| 5 | 服务号后台配置 4 项 | 是 | 配置 1h | 待 #4 |
| 6 | HTTPS 证书 | 是 | 1h | 待 #2 |
| 7 | 域名 DNS 解析到 `43.129.186.82` | 是 | 1h | 待 #2 |
| 8 | 隐私政策 + 用户协议托管页 | 是 | 0.5d | 立即 |
| 9 | 微信开放平台账号（如需 unionid） | 否 | 1d | 可选 |

M0 不阻塞本地开发——所有微信路径用本地 mock，到 M3 才需要真值。

### 7.2 部署架构（单容器，A 方案）

```
[ 公网用户 / 微信内置浏览器 ]
       ↓
[ DNS qingyun.xxx.com → 43.129.186.82 ]
       ↓
[ Nginx (新增, 80/443) ]
   - HTTPS 终结
   - HTTP → HTTPS 强制跳转
   - 反向代理到 :3000
   - rate limit: 100 req/s/IP burst 20
       ↓
[ Docker container: qingyun-ai (3000) ]
   - Next.js 16.2.4 standalone
   - SQLite at /app/data/qingyun.db
   - node-cron 进程内调度
   - SSE long connection
       ↓
[ Volume: ~/occult/data ] (uid 1001)
```

**Nginx 配置**（`~/occult/nginx/conf.d/qingyun.conf`）：

```nginx
server {
    listen 80;
    server_name qingyun.xxx.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qingyun.xxx.com;
    
    ssl_certificate /etc/letsencrypt/live/qingyun.xxx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qingyun.xxx.com/privkey.pem;
    
    client_max_body_size 5M;
    
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 90s;
    proxy_send_timeout 90s;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
    
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffering off;
    }
}
```

**docker-compose.yml**（修改）：

```yaml
services:
  qingyun:
    image: occult-qingyun:latest
    container_name: qingyun-ai
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./data:/app/data
    env_file: .env.prod
    networks:
      - default

  nginx:
    image: nginx:alpine
    container_name: qingyun-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - qingyun
```

### 7.3 6 个里程碑分批部署

#### M1（W1-W2）地基 — 12 工作日

部署内容：

- schema wipe 重建（14 表 + FTS5 虚拟表）
- 微信 OAuth 端到端跑通（用户能登录 H5）
- 多档案 A3 schema + CRUD API
- middleware 鉴权

部署 checklist：

- [ ] M0 域名 + HTTPS + 备案完成
- [ ] 服务号 4 项后台配置完成
- [ ] `.env.prod` 含 `WECHAT_*` 全套
- [ ] `pnpm db:reset` 跑通
- [ ] `curl -sS https://qingyun.xxx.com/api/healthz` 200
- [ ] 微信内打开 H5 → OAuth 跳转 → callback → / 首页
- [ ] uid 1001 owns ./data

#### M2（W3-W5）四大意图核心流 — 18 工作日

部署内容：

- /api/chat 路由器升级（22 ui types）
- 抽签流（slip_type_picker → drawing → image → report）
- 解梦流（fast / precise modal）
- 八字流（profile_picker → focus → form 缺档案分支）
- 梅花流（profile_picker → 数字输入）
- profile_picker 组件
- 22 ui types 的 MessageBubble dispatcher

checklist：

- [ ] 4 大意图 E2E 跑通
- [ ] 长任务 ≤60s 不报错
- [ ] 限流 30/h 生效
- [ ] safety guard 拦截禁词
- [ ] 历史抽屉打开能看到列表

#### M3（W6-W8）首页 + 运势 cron + 服务号集成 — 18 工作日

部署内容：

- DailyFortuneCardV2（7 维度）
- LauncherGrid（4 入口）
- /api/fortune 端点
- node-cron：每日 0:30 跑 `daily-fortune-push`
- 服务号模板消息推送
- JS-SDK 配置端点

checklist：

- [ ] cron 0:30 跑通，所有 active user 收到模板消息
- [ ] 模板消息点击跳到 /fortune
- [ ] 抽签报告"保存"按钮调 wx.previewImage 成功
- [ ] cron_runs 表有日志
- [ ] wechat_template_log 表有发送记录

#### M4（W9-W12）算法 V2 — 25 工作日

部署内容：

- 八字 V2 规则引擎（神煞 + 大运 + 流年 + 用神）
- 梅花 V2 image18 完整流程（5 卦 + 时辰能量场 + 损益）
- 64 卦字典（B 方案：开源 json + 手修 20%）
- 历史搜索（FTS5 messages 反查）

checklist：

- [ ] 八字解读包含神煞段落
- [ ] 梅花解读包含时辰能量 + 五行损益
- [ ] 历史搜索"上次抽到什么签"能命中
- [ ] AI 调用 token 数量 < 5000 input / response

#### M5（W13-W15）周月运势 + 收尾 — 18 工作日

部署内容：

- 每周运势 cron（周一 1:00）
- 每月运势 cron（月初 1:30）
- DayWeekMonthSwitcher / DateRangeStrip
- /fortune 完整解读卡
- 现居地选择器（CurrentAddressPicker）
- 完善 onboarding 流

checklist：

- [ ] 周一切到周运势能看到数据
- [ ] 月初切到月运势能看到数据
- [ ] 现居地 3 级联动正常
- [ ] onboarding 走完能进首页

#### M6（W16-W17）联调 + Bug 大扫除 + 上线 — 9 工作日

部署内容：

- E2E Playwright 全套跑通
- 性能优化（首屏 LCP < 2.5s）
- 错误监控（Sentry 接入）
- 备用 AI 网关开关

### 7.4 ENV 完整清单

```bash
# Database
DATABASE_URL=file:/app/data/qingyun.db

# AI Gateway
AI_GATEWAY_BASE_URL=https://api.ofox.ai/v1
AI_GATEWAY_API_KEY=ofx-...
AI_GATEWAY_MODEL=deepseek/deepseek-v4-pro
AI_TIMEOUT_MS=60000

# WeChat 服务号
WECHAT_APPID=wx...
WECHAT_APPSECRET=...
WECHAT_STATE_SECRET=base64-32-bytes
WECHAT_AES_KEY=base64-32-bytes
WECHAT_TPL_DAILY_FORTUNE=template-id-1
WECHAT_TPL_REPORT_READY=template-id-2
WECHAT_OA_REDIRECT_URI=https://qingyun.xxx.com/api/auth/wechat/callback

# App
PUBLIC_BASE_URL=https://qingyun.xxx.com
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
SESSION_SECRET=base64-64-bytes

# Rate Limit
RATE_LIMIT_PER_HOUR_CHAT=30
RATE_LIMIT_PER_HOUR_BAZI=5
RATE_LIMIT_PER_HOUR_MEIHUA=5
RATE_LIMIT_PER_HOUR_DIVINATION=10
RATE_LIMIT_PER_HOUR_DREAM=10

# Cron
CRON_DAILY_FORTUNE='30 0 * * *'
CRON_WEEKLY_FORTUNE='0 1 * * 1'
CRON_MONTHLY_FORTUNE='30 1 1 * *'
CRON_TZ='Asia/Shanghai'

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
```

M3 后必须每次部署验证：

```bash
docker compose exec qingyun env | grep -E '^(WECHAT_|AI_GATEWAY_|SESSION_)' | wc -l
# 应该 ≥ 9
```

### 7.5 数据备份 / 回滚（MVP 阶段不做）

**TODO 上线后真有用户必须补**：

- 每天 03:00 sqlite3 .backup → gz → 保留 30 天
- 备份脚本跑在 host 不在容器（避免容器重启丢备份）
- 恢复演练（M6 阶段必跑一次）

MVP 阶段所有用户都是测试数据，可以直接覆盖部署，失败则重新跑。但这是技术债，量起来必须补。

### 7.6 监控 + 日志

| 维度 | 工具 | 告警阈值 |
|---|---|---|
| HTTP 错误率 | Nginx access.log + 自建 | 5xx > 1% / 5min |
| AI 调用失败率 | 自建 | > 10% / 5min |
| Cron 失败 | cron_runs 表 | 任意 |
| 模板消息发送失败 | wechat_template_log | > 5% / 1h |
| SQLite 大小 | 监控脚本 | > 500MB |
| 容器健康 | docker compose ps + healthcheck | unhealthy |
| 错误日志 | Sentry | 任意 ERROR |

Sentry 接入（M6）：

```ts
// next.config.ts
import { withSentryConfig } from "@sentry/nextjs";
// instrumentation.ts: Sentry.init({ dsn: process.env.SENTRY_DSN })
```

只对 ERROR 级别上报。

### 7.7 部署流程

```bash
# 本地：1. 测试 + 类型检查 + lint
pnpm typecheck && pnpm test && pnpm lint

# 本地：2. 生成 patch
git diff > /tmp/qingyun-{milestone}.patch

# 推送：3. scp 到服务器
scp -i ~/Downloads/renliang.pem /tmp/qingyun-{milestone}.patch \
  ubuntu@43.129.186.82:~/occult/

# 服务器：4. apply + 重建（必须 --no-cache）
ssh -i ~/Downloads/renliang.pem ubuntu@43.129.186.82 << 'EOF'
cd ~/occult
git apply qingyun-{milestone}.patch
docker compose build --no-cache
docker compose up -d
sleep 5
docker compose logs --tail=30 qingyun
curl -sS http://127.0.0.1:3000/api/healthz
EOF

# 验证：5. 外部 + 微信内
curl -sS https://qingyun.xxx.com/api/healthz
# + 微信里点公众号菜单走一遍核心流
```

### 7.8 常见故障 runbook

| 故障 | 排查 | 修复 |
|---|---|---|
| 微信 OAuth 502 | 检查 `WECHAT_OA_REDIRECT_URI` 与服务号后台配置一致 | 改 .env.prod，重建 |
| 模板消息全部失败 | 看 `wechat_template_log.raw_response`，errcode=42001 | access_token 过期，强制刷新 |
| 抽签大图保存按钮无响应 | 看 console，wx.config 是否报错 | 检查 jsapi_ticket + 安全域名配置 |
| Cron 没跑 | 看 cron_runs 表 + container logs | 检查 CRON_TZ + 容器是否重启过 |
| H5 白屏 | 看 Nginx error.log | 多半是 SSL 证书 / 反向代理路径问题 |
| SQLite database locked | 看 long task 是否在写 | 加 BEGIN IMMEDIATE 串行 |

---

## 8. 测试 + 风险

### 8.1 测试金字塔

```
                          ┌──────────────┐
                          │ E2E (10)     │   Playwright
                          └──────────────┘
                       ┌────────────────────┐
                       │ Integration (35+)  │   Vitest + supertest
                       └────────────────────┘
                  ┌──────────────────────────────┐
                  │  Unit (200+)                 │   Vitest，覆盖率 80%+
                  └──────────────────────────────┘
```

### 8.2 单元测试覆盖（~200 cases）

| 模块 | 用例数 | 关键场景 |
|---|---|---|
| `lib/ai/intent.ts` | 30+ | 关键词层 + LLM 兜底 |
| `lib/ai/summarizer.ts` | 15+ | 触发阈值 / 增量摘要 / K_RECENT 切片 |
| `lib/fortune/scorer.ts` | 20+ | 7 维度计算 + 边界 |
| `lib/fortune/attributes.ts` | 15+ | 8 属性映射 + 五行规则 |
| `lib/divination/slips.ts` | 15+ | 100 签命中 + 加权随机确定性 |
| `lib/divination/meihua-v2.ts` | 25+ | 5 卦 + 体用 + 时辰能量 + 五行损益 |
| `lib/bazi/stems-branches.ts` | 15+ | 干支推算 |
| `lib/bazi/shensha-rules.ts` | 30+ | 30 条神煞（每条 1 个正例 + 1 反例） |
| `lib/bazi/dayun.ts` | 10+ | 大运起运 + 流年 |
| `lib/bazi/yong-shen.ts` | 12+ | 格局判断 + 用神锁定 |
| `lib/wechat/oauth.ts` | 10+ | state 签名 / code 换 token / userinfo |
| `lib/wechat/token-store.ts` | 8+ | 内存缓存 / SQLite 兜底 / 过期刷新 |
| `lib/wechat/template-message.ts` | 8+ | 推送参数 / errcode 处理 |
| `lib/cron/*.ts` | 10+ | 调度时机 / 失败重试 |
| `lib/dimensions/{seven,six}.ts` | 5+ | 维度集合常量 + 类型守卫 |

覆盖率工具：vitest `--coverage`，目标 ≥ 80%。

### 8.3 集成测（API 端点，~35 cases）

| API | 关键测试 |
|---|---|
| `POST /api/auth/wechat` | 跳转 URL 正确（含 state） |
| `GET /api/auth/wechat/callback` | code → user_id 全流程 + 首次创建 default profile + state 验签失败 401 |
| `POST /api/me/phone/verify` | 验证码 6 位 / 60s 重发限制 |
| `POST /api/me/phone/change` | 旧码验证 + 新码验证 + 唯一约束 |
| `GET/POST/PUT/DELETE /api/me/profiles` | A3 约束（最多 1 default）+ 物理删 + 不能删默认档案（应用层校验）+ 删除后相关 conversations/messages.profile_id 自动 SET NULL |
| `POST /api/chat` | 5 意图 + intent= query + 限流 + 安全词 + 长文本 400 |
| `GET /api/chat/conversations` | 历史抽屉分页 + summary |
| `POST /api/divination/qianwen` | 抽签 + slipNumber 范围 + AI 失败兜底 |
| `POST /api/divination/qianwen/explain` | 已抽未解 → 解 / idempotent |
| `GET /api/divination/slip-image/[n]` | PNG 字节 + 字体渲染 (>30KB) |
| `POST /api/divination/bazi` | profile 缺失 → quick_form / focus 维度合法 |
| `POST /api/divination/dream` | mode 二选一 + precise 4 字段必填 |
| `POST /api/divination/meihua` | 1-3 数字 1-9 校验 |
| `GET /api/fortune` | scope=daily/weekly/monthly + 缺失懒加载 |
| `GET /api/wechat/jssdk-config` | 签名正确 + url 校验 |
| `GET /api/intent/classify` | 仅前端预判，不写 DB |
| `GET /api/healthz` | 200 + json |
| Cron 内部触发 | `daily-fortune-push` → 写 fortunes_daily + 推模板 + 写日志 |

### 8.4 E2E Playwright 关键流（~10 cases）

| # | 流程 | 主要步骤 |
|---|---|---|
| 1 | 微信登录全流程 | mock OAuth → callback → / 首页显示昵称 |
| 2 | 首次完善档案 | /onboarding → 填写 → / 显示运势 |
| 3 | 抽签全流程 | / → launcher → 选事业学业 → 输入 → 摇签 → 大图 → 解读 → report |
| 4 | 解梦快速 | /chat → "做了梦" → 选快速 → 输描述 → 流出结果 |
| 5 | 解梦精准 modal | 同上但选精准 → modal 弹出 → 4 字段 → 提交 → 流出 |
| 6 | 八字（缺档案） | mock 无 default → /chat → 看八字 → quick_form → 填 → result |
| 7 | 八字（有档案 A3） | /chat → 看八字 → profile_picker → 选档案 → focus → result |
| 8 | 梅花 | /chat → 测一下 → profile_picker → numbers + question → result |
| 9 | 多档案管理 | /me/profiles → 添加 → 编辑 → 切默认 → 删除非默认 → 不能删默认 |
| 10 | 历史抽屉 + 搜索 | /chat → 抽屉 → 搜关键词 → 跳到旧会话 |

E2E 跑在 docker，Playwright + ofMock（mock 微信 OAuth + AI 网关）。

### 8.5 V1.0 已踩坑（13 项保留）+ 新增 7 项

#### V1.0 已知 13 项

1. zod schema 接 `conversationId: null` 必须用 `.nullish()`
2. `AI_TIMEOUT_MS=60000`，30s 太紧
3. shadcn Select trigger 关闭显示 raw value，自渲染 trigger label
4. DatePicker 历法切换必须独立 state（pickedCalendar）
5. React 18 流式 batching：必须 RAF 节流 + finally cancelAnimationFrame
6. 服务器 `~/occult` 不是 git repo，patch 上下文易飘
7. `.env.prod` 易丢，每次 deploy 后必须 grep 验证
8. 容器 nextjs uid=1001 ≠ host ubuntu uid=1000 → SQLITE_CANTOPEN
9. pnpm isolated layout：native 依赖在 `.pnpm/`，不要 Dockerfile 显式 COPY
10. shadcn Select 控制模式 + Content 关闭显示 raw value
11. SSE 流断开时 controller 已 close 还 enqueue → 崩溃，需 try/catch
12. cookie SameSite=None 在微信内置浏览器随机失败 → 用 Lax
13. fetch 在 SSR 时 baseURL 必须绝对路径

#### 新增 V2.0 7 项风险

14. **微信 OAuth 内嵌浏览器 cookie 隔离** — 微信内打开 H5 与外部 Safari 是不同 cookie 域，开发时不能用 Safari 调试 OAuth 真实流程，必须微信开发者工具 + 真机
15. **服务号 access_token 全局共享** — 同 appid 多端调 token 接口会互相覆盖。必须严格走 token_store 缓存层。**测试环境用 mock，生产 token 接口禁止本地调**
16. **node-cron 单进程** — Next.js standalone 容器是单 Node 进程，cron 在请求高峰时会抢 CPU。修法：cron 任务用 `setImmediate` 拆批 + 限制并发（每次最多 10 个用户算运势）
17. **SQLite WAL 在 Docker volume 上 fsync 慢** — 大批量写一次 commit 几十 MB 易锁库 30s+。修法：每 100 行 commit 一次
18. **微信内置浏览器 SSE 长连超过 60s 断流** — X5 内核默认 60s 超时关连接。修法：每 25s 发 SSE comment heartbeat (`: ping\n\n`)
19. **微信内打开 H5 不支持 ASR / 不支持下载流式音频** — P2 砍掉的语音 ASR，未来要做必须用微信 JSSDK 的 startRecord/stopRecord
20. **64 卦字典开源数据版权 / 风格不一** — B 方案 80% 可用，剩余 20% 需手修。这一步用文心一言 / GPT 改写一遍统一风格更稳

### 8.6 性能预算

| 指标 | 目标 | 测量 |
|---|---|---|
| 首页 LCP | < 2.5s（移动 4G） | Lighthouse mobile |
| /chat TTI | < 3s | 同上 |
| SSE first token 时延 | < 5s（chat）< 8s（其他） | 自建 perf log |
| AI 端到端 | < 15s（chat）< 60s（八字/梅花） | messages.tokens_used |
| API p95 | < 800ms（非 AI） | Nginx access.log |
| SQLite 单文件 | < 500MB / year（10k 用户估算） | du -sh |
| Bundle size | < 300KB initial JS gzipped | Next.js build report |

### 8.7 内容安全 + 合规

| 项 | 实现 |
|---|---|
| 禁词列表 | `lib/safety/banned-words.ts`（V1.0 已有，扩到 200+ 词） |
| 用户输入安全词命中 | 拒绝 + 提示"这个话题暂时聊不动" |
| AI 输出黑名单兜底 | 流式输出后整段过滤 |
| 大凶 / 倒霉 / 厄运 等绝对负面词 | 系统 prompt 锁定 |
| 用户可删数据 | DELETE `/api/me` → 删 user 行（CASCADE 全清）+ 调微信 `oauth2/revoke` |
| 用户可下载数据 | GET `/api/me/export` → JSON 全量打包 |
| 隐私政策弹窗 | OAuth 前一次性弹窗，确认后写 `users.privacy_accepted_at`，不再弹 |
| 18 岁以下警告 | profile 出生 < 18 岁 → 弹"未成年请在监护人指导下使用"，不阻塞 |

### 8.8 整体风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| M0 备案延迟（>20 天） | 中 | 阻塞 M3 | 提前申请 / 同时申请第二域名兜底 |
| 服务号认证驳回 | 低 | 阻塞 M1 OAuth | 资质提前自查 |
| AI 网关 ofox 单点故障 | 中 | 全意图不可用 | M6 接 1 个备用网关 |
| SQLite 写性能瓶颈（>5k 用户后） | 高 | retention cron 跑不完 | 上线后每月监控，破 1h 切 Postgres |
| 微信平台政策变化 | 低 | 算命类被下架 | 申请前对照 §3.4 自查；保留独立域名 H5 兜底 |
| 单人 90 天工期延期 | 中 | 推迟上线 | 每周回顾 + 砍 P1 边缘功能 |

### 8.9 上线前 checklist（M6 完成后）

- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 35+ API 集成测全过
- [ ] 10 个 E2E 流程全过
- [ ] Lighthouse 移动版 LCP < 2.5s
- [ ] 微信开发者工具 + 真机各跑一遍 10 个 E2E
- [ ] Sentry 接通 + ERROR 上报正常
- [ ] 限流命中能正确返回 429
- [ ] 安全词命中能正确拦截
- [ ] 隐私政策 + 用户协议页面在线
- [ ] cron 全部 4 个任务有 cron_runs 日志
- [ ] AI 网关备用方案至少配好开关
- [ ] 数据备份脚本（TODO 上线后）

---

## 9. 范围外（V2.0 不做的）

明确**不在本次 spec 范围**的功能模块（P2 砍 / 文档外延）：

1. 塔罗占卜（文档提到但无原型，未来按用户呼声决定）
2. 语音 ASR 输入（accessibility 加分项，未来微信 JSSDK 可加）
3. 会员订阅 + 微信支付（变现层，MVP 阶段过早优化）
4. 客服消息（异步通知 nice-to-have）
5. 桌面端 / 微信小程序 / 独立 App（合规风险，全量 H5 in 服务号）
6. 多语言 i18n（仅中文）
7. 朋友圈分享卡片（P1 末期可加，看时间）
8. 用户画像 / 推荐系统（用户数据未达样本量）
9. 实时消息推送（WebSocket，超出 SSE 即可）
10. 真实数据备份 / 回滚（MVP 阶段不做，TODO 上线后必须补）

---

## 10. 文件结构（参考）

```
/Users/edy/Desktop/workspace/occult/
├── app/
│   ├── (root)/
│   │   ├── page.tsx                    -- / 首页 image2
│   │   └── layout.tsx
│   ├── chat/
│   │   ├── page.tsx                    -- /chat
│   │   └── _components/
│   │       ├── ChatWindow.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── HistoryDrawer.tsx       -- 新
│   │       ├── DreamPreciseModal.tsx   -- 新
│   │       ├── ChatInput.tsx
│   │       └── cards/
│   │           ├── SlipImageFullscreen.tsx  -- 新
│   │           ├── SlipReportCard.tsx       -- 新
│   │           ├── ProgressLongTaskCard.tsx -- 新
│   │           ├── ProfilePickerCard.tsx    -- 新
│   │           ├── ShakeSlipAnim.tsx        -- 新
│   │           ├── ErrorCard.tsx            -- 新
│   │           └── ... (V1.0 复用)
│   ├── fortune/
│   │   └── page.tsx                    -- /fortune image3
│   ├── me/
│   │   ├── page.tsx                    -- /me image21
│   │   ├── edit/page.tsx               -- /me/edit image22
│   │   ├── phone/
│   │   │   ├── verify/page.tsx         -- image23
│   │   │   └── new/page.tsx            -- image24
│   │   └── profiles/
│   │       ├── page.tsx                -- /me/profiles image4
│   │       ├── new/page.tsx            -- image5
│   │       └── [id]/edit/page.tsx
│   ├── onboarding/
│   │   └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── wechat/
│   │   │       ├── route.ts            -- 启动 OAuth
│   │   │       └── callback/route.ts
│   │   ├── chat/
│   │   │   ├── route.ts                -- SSE
│   │   │   └── conversations/
│   │   │       ├── route.ts
│   │   │       └── search/route.ts     -- FTS5
│   │   ├── divination/
│   │   │   ├── qianwen/route.ts
│   │   │   ├── qianwen/explain/route.ts
│   │   │   ├── bazi/route.ts
│   │   │   ├── meihua/route.ts
│   │   │   ├── dream/route.ts
│   │   │   └── slip-image/[n]/route.ts -- Canvas PNG
│   │   ├── fortune/route.ts
│   │   ├── intent/classify/route.ts
│   │   ├── me/
│   │   │   ├── route.ts
│   │   │   ├── profile/route.ts
│   │   │   ├── profiles/route.ts
│   │   │   ├── profiles/[id]/route.ts
│   │   │   ├── phone/
│   │   │   │   ├── verify/route.ts
│   │   │   │   └── change/route.ts
│   │   │   └── export/route.ts
│   │   ├── wechat/
│   │   │   └── jssdk-config/route.ts
│   │   └── healthz/route.ts
│   └── legal/
│       ├── privacy/page.tsx
│       └── terms/page.tsx
├── components/
│   ├── su/                             -- V1.0 保留
│   │   ├── GlassCard.tsx
│   │   ├── Sparkle.tsx
│   │   ├── Divider.tsx
│   │   └── WatercolorDot.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── AppHeader.tsx
│   │   └── BottomNav.tsx
│   ├── fortune/
│   │   ├── DailyFortuneCardV2.tsx      -- 重做
│   │   ├── ScoreRing.tsx
│   │   ├── DimensionBars7.tsx          -- 新
│   │   ├── AttributesGrid8.tsx         -- 重做
│   │   ├── LauncherGrid.tsx            -- 新
│   │   ├── DayWeekMonthSwitcher.tsx    -- 新
│   │   ├── DateRangeStrip.tsx          -- 新
│   │   ├── DimensionDetailCards.tsx    -- 新
│   │   └── DeepAskButton.tsx           -- 新
│   ├── divination/
│   │   ├── BaziResultCard.tsx
│   │   ├── DreamResultCard.tsx
│   │   ├── MeihuaResultCard.tsx
│   │   └── SlipResultCard.tsx
│   ├── profile/
│   │   ├── ProfileSummaryCard.tsx      -- 新
│   │   ├── ProfileCardList.tsx         -- 新
│   │   ├── ProfileForm.tsx             -- 新
│   │   ├── PhoneBindingRow.tsx         -- 新
│   │   ├── AvatarPicker.tsx            -- 新
│   │   ├── PhoneInput.tsx              -- 新
│   │   ├── PhoneCodeInput.tsx          -- 新
│   │   └── CurrentAddressPicker.tsx    -- 新
│   ├── onboarding/
│   │   ├── DatePicker.tsx              -- V1.0 保留
│   │   ├── HourSelector.tsx            -- V1.0 保留
│   │   └── OnboardWizard.tsx           -- 新
│   └── wechat/
│       ├── WeChatShareButton.tsx       -- 新
│       └── WeChatSaveImage.tsx         -- 新
├── lib/
│   ├── ai/
│   │   ├── intent.ts                   -- V1.0 保留扩展
│   │   ├── intent-keywords.ts
│   │   ├── summarizer.ts               -- V1.0 保留
│   │   ├── client.ts                   -- V1.0 ofox client
│   │   ├── gateway.ts                  -- V1.0 抽象
│   │   ├── prompts/
│   │   │   ├── system-base.ts
│   │   │   ├── chat-prompt.ts
│   │   │   ├── slip-interpret.ts
│   │   │   ├── bazi-interpret.ts
│   │   │   ├── meihua-interpret.ts
│   │   │   ├── dream-fast.ts
│   │   │   ├── dream-precise.ts
│   │   │   └── fortune-reading.ts
│   │   └── check-rate-limit.ts
│   ├── auth/
│   │   ├── session.ts
│   │   └── cookie-flags.ts
│   ├── bazi/
│   │   ├── stems-branches.ts           -- V1.0
│   │   ├── shensha-rules.ts            -- 新（30 条神煞）
│   │   ├── dayun.ts                    -- 新（大运 + 流年）
│   │   └── yong-shen.ts                -- 新（格局 + 用神）
│   ├── cron/
│   │   ├── index.ts                    -- 新（node-cron 注册）
│   │   ├── daily-fortune-push.ts       -- 新
│   │   ├── weekly-fortune.ts           -- 新
│   │   └── monthly-fortune.ts          -- 新
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts                   -- 大改（14 表）
│   │   └── json.ts
│   ├── dimensions/
│   │   ├── seven.ts                    -- 新（首页 7 维度）
│   │   └── six.ts                      -- 新（抽签 6 维度）
│   ├── divination/
│   │   ├── slips.ts                    -- 重做
│   │   └── meihua-v2.ts                -- 新
│   ├── fortune/
│   │   ├── scorer.ts                   -- 重做（7 维度）
│   │   └── attributes.ts               -- 重做（8 属性查找表）
│   ├── safety/
│   │   ├── guard.ts
│   │   └── banned-words.ts
│   └── wechat/
│       ├── oauth.ts                    -- 新
│       ├── token-store.ts              -- 新
│       ├── template-message.ts         -- 新
│       ├── jssdk-config.ts             -- 新
│       └── client.ts                   -- 新
├── db/
│   ├── seed/
│   │   ├── slips-v2.ts                 -- V1.0 100 签复用 / 改字段
│   │   └── gua64.ts                    -- 新（B 方案）
│   └── migrations/                      -- wipe 不用，留壳
├── e2e/
│   ├── healthz.spec.ts
│   ├── wechat-login.spec.ts            -- 新
│   ├── divination-flow.spec.ts         -- 新
│   ├── dream-flow.spec.ts              -- 新
│   ├── bazi-flow.spec.ts               -- 新
│   ├── meihua-flow.spec.ts             -- 新
│   ├── profile-management.spec.ts      -- 新
│   └── history-search.spec.ts          -- 新
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-04-27-qingyun-full-impl-design.md  -- 本文档
        └── plans/
            └── (writing-plans 输出)
```

---

## 11. 开发节奏总览

```
W1-W2   M1 地基（schema + 微信 OAuth + 多档案 + middleware）        12 工作日
W3-W5   M2 四大意图核心流（22 ui + chat 路由器）                    18 工作日
W6-W8   M3 首页 + 运势 cron + 服务号集成                           18 工作日
W9-W12  M4 算法 V2（八字 + 梅花 + 64 卦 + 历史搜索）                25 工作日
W13-W15 M5 周月运势 + 收尾                                         18 工作日
W16-W17 M6 联调 + Bug + 上线                                        9 工作日
        ─────────────────────────────────────────────────────
        合计：                                                   100 工作日
```

每个 M 结束 = 一次完整部署到生产，可独立 demo。

---

## 12. 已知约束 + 设计 trade-off 摘要

1. **单容器单 SQLite** = 简单部署，代价是 5k+ 用户后必须切 Postgres
2. **A3 多档案模式** = UI 简单，代价是失去"切档案看运势"，但保留多档案核心场景
3. **维度二元化（7 + 6）** = 业务语义清晰，代价是 schema 多两个常量
4. **8 lucky attributes 不靠 AI** = 稳定，代价是不能根据节日 / 时令 dynamic 调整
5. **64 卦 B 方案** = 3 天搞定，代价是 20% 需手修风格统一
6. **C 视觉策略** = 保留素笺骨架，代价是抽签报告页的"古朴感"靠 CSS 模拟，不如真出图
7. **MVP 不做备份** = 节省时间，代价是真有用户后必须补（标记 TODO）
8. **服务号每月 4 条模板消息上限** = retention 工具受限，代价是不能高频骚扰用户

---

## 13. 下一步

- spec 完成 → 自审 → 提交 git
- writing-plans 写 100 工作日的细颗粒度 task list（按 6 milestone 分批）
- M0 阶段同步推进备案 + 服务号认证

