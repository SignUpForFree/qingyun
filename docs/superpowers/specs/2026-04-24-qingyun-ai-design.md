# 福小运 · V1.0 MVP 设计方案

> **日期**：2026-04-24（V1 初稿）
> **作者**：edy + Claude（brainstorming skill）
> **状态**：已确认 + 三份实现计划已落（P1/P2/P3）
> **源需求**：`/Users/edy/Downloads/福小运需求文档.docx`
>
> **修订摘要（按时间倒序）**：
> - **2026-04-26（深夜）**：P1 骨架按 user 反馈大改 — (1) 砍 docker，B 节走 Supabase Cloud 单一路径（A4 砍 Vercel + GitHub remote，部署完整推到 P3 P2）；(2) 八字 ground truth 推迟，C1/C5 改为 case 1 self-consistency baseline + case 2/3 `it.skip` 占位；(3) 加"执行顺序调整"章节，A→S→C→D→E（27h，零外部账号 / 零 docker）前置到 W1，B/F/G 推到 W2。.env.example 全占位，W1 D1-D5 不需要任何真实 key。Definition of Done 不变。
> - **2026-04-26（晚）**：跨文档一致性审计完成（详见 `docs/superpowers/specs/2026-04-26-cross-doc-audit.md`）。修 1 CRIT（P2 G1 路径 5 验收降级）+ 7 INFO（feedback 表入 spec / prompts schema 改 unique(key,version) / BaziChart V1.0 文字版分级 / chat.general prompt 落表 / V1.0.5 工时上调到 26.5h / P1 A1 加 .gitignore merge / P2 注释勘误）。spec ↔ plan 严重不一致点 1 → 0。总工时 191h → 197h。
> - **2026-04-26**：P1 骨架 + P3 上线 计划补"素笺仙气视觉系统"。新增 P1 Section S（tailwind token + 仙气原子 + AppShell）；P2 新增 Task D7 `/fortune/[date]` 详情页；P2 D6 改为按设计 §1 Home 规约直接实装；P3 N1 加 14 单元终态视觉走查 gate；P3 L1 加 loading.tsx + §13 "小恙"错误页。三份 plan 共加 ~1180 行，总工时 191h ≈ 24 工作日（5 周 MVP + V1.0.5 W6–W7）。
> - **2026-04-26**：P1（骨架 W1–W2）+ P3（上线 W5 + V1.0.5）实现计划落盘。配合既有 P2（功能 W3–W4），三阶段总 85 task / 191h。
> - **2026-04-24（夜）**：14 个全局页面/组件视觉 prompt 包落盘 `docs/superpowers/designs/prompts-all-pages.md`，定 "素笺仙气 Su Jian Xian Qi" 为 V1.0 全局设计语言。MeihuaResultCard 最终 mockup 落 `meihua-result-card-20260424/a-refined-fairy.html`。
> - **2026-04-24**：梅花易数从 V1.1 提前到 V1.0 + V1.0.5 分批上线。V1.0 含 2 种起卦方式（时间/数字）+ 档 4 完整解读（本/互/变/卦中卦 + 体用生克 + 应期推算 + 外应 AI 对话）；V1.0.5 补齐 3 种起卦方式（报数/文字/摇铜钱动画）。5 周 MVP 时间不延，W3 末设硬 gate。
> - **2026-04-24**：V1 初稿 — Next.js + Supabase + DeepSeek + lunar-javascript 1 人 5 周 Web MVP。

---

## 0. 一句话总结

**Next.js + Supabase + DeepSeek + lunar-javascript** 的 1 人 Web MVP，5 周内上线"档案 + AI 对话 + 抽签 + 解梦 + 八字解读 + 首页运势 + 梅花易数"7 个核心闭环，部署到 Vercel 默认域名作为测试环境。数据模型为多档案做好准备但 UI 不露出；AI 层走 **规则引擎（确定性） + DeepSeek（解读）** 的分离架构，prompt 全部落表便于零发版调优；运势评分用简化版公式，等正式规则引擎到位后只替换一个文件。梅花易数走档 4（专家档）：体用/应期硬算 + 外应 AI 对话式。月成本 < ¥200。

---

## 1. 约束与决策摘要

| 维度 | 决策 | 理由 |
|---|---|---|
| 产品形态 | Web（H5） | 最快上线，后续再扩展小程序/App |
| 团队 | 1 人 | 必须极简技术栈 + 托管服务 |
| 上线目标 | 测试环境（`*.vercel.app`） | 前期不推广，先跑通核心流程给种子用户用 |
| 备案 | 暂不做 | 测试期不需要；正式上线再补 |
| 技术栈 | Next.js 15 + Supabase + DeepSeek + Vercel | 单仓一体化，1 人可维护 |
| 登录方式 | Supabase 匿名登录 | 0 门槛；可后续升级为手机号 |
| 数据范围 | 方案 A（极简 MVP） | 砍梅花易数测算、语音输入、多档案 UI、精准解梦表单、运势推送、会员 |
| 八字计算 | `lunar-javascript` | 开源、免费、支持真太阳时 |
| UI 方案 | shadcn/ui + Tailwind + v0.dev 主视觉 | 1 人做不动全定制 UI |
| AI 模型 | DeepSeek | 国内直连、便宜、中文效果好 |
| AI 缓存 | 按用户+日期缓存运势、按 session 缓存解读 | 省钱 + 支持历史记录 |
| 月成本 | < ¥200 | Vercel Free + Supabase Free + ~¥60–150 DeepSeek |

---

## 2. MVP 功能范围

### 2.1 包含（7 个核心闭环）

1. **M1 档案**：首次打开 → 引导建档案（出生时间、出生地、性别）→ 入库
2. **M2 首页运势**：读档案 → 算八字 + 当日干支 → AI 出 7 维度解读 → 缓存
3. **M3 AI 对话**：意图识别 → 分发到抽签/解梦/八字/梅花/通用问答 → 流式返回 → 落库
4. **M4 抽灵签**：6 类主题 + 用户问题 → 随机抽签 → AI 结合签文 + 问题做解读（在 M3 内的子流程）
5. **M5 AI 解梦**：快速模式对话引导 → 三重维度解读（周公 + 弗洛伊德 + 荣格）
6. **M6 八字解读**：档案已存在 → 直接排盘 → AI 解读 + 追问
7. **M7 梅花易数测算**：时间/数字 2 种起卦方式 → 档 4 完整推演（本/互/变/卦中卦 + 体用 + 应期）→ 4 宫格卡片 + AI 流式解读 + 外应轻问（V1.0.5 补齐 3 种起卦方式）

### 2.2 不包含

**V1.0.5（MVP 上线后 2–3 周内补）**：
- 梅花易数 · 报数起卦
- 梅花易数 · 文字起卦（按笔画）
- 梅花易数 · 摇铜钱起卦 + Lottie 动画

**V1.1 回补清单**：
- 周/月运势详情
- 精准解梦表单
- 语音输入（ASR）
- 每日运势定时推送（cron + 推送渠道）
- 多档案切换 UI（数据模型支持，只是不露出）
- 微信授权登录 + 手机号换绑
- 八字规则引擎对接（等独立 PRD 到）
- 塔罗牌（P1）
- 会员/解锁未来运势
- 自定义域名 + ICP 备案
- Cloudflare 前置加速

---

## 3. 系统架构

### 3.1 总览图

```
 浏览器（国内用户）
   ↓ 直连 *.vercel.app （测试期）
   ↓
 Next.js 15 App Router（Vercel 托管）
 ├─ 前端：RSC + shadcn/ui + Tailwind
 ├─ API Routes：/api/chat (SSE)、/api/fortune/daily、/api/divination/*
 └─ 服务端库：lunar-javascript（八字）+ AI Gateway
   ↓
 Supabase（数据 + 认证 + 存储）
 ├─ Auth (anonymous)
 ├─ Postgres（所有业务数据）
 └─ Storage（头像、签文图）
   ↓
 DeepSeek API（deepseek-chat，流式）
```

### 3.2 模块划分

**功能闭环（用户可见）**：M1–M6，见第 2.1 节。

**基础设施（用户不可见）**：
- **I1 AI Gateway**：统一调 DeepSeek，含流式、超时、错误处理、token 统计、用户级限流
- **I2 意图路由器**：识别 `divination/dream/bazi/meihua/chat` 五种意图，分发到对应 Prompt 模板
- **I3 八字计算器**：lunar-javascript 封装，公历/农历 → 真太阳时 → 四柱干支/五行/十神/大运
- **I4 梅花易数引擎**：起卦（时间/数字）+ 互卦/变卦/卦中卦推演 + 体用生克判断 + 应期推算。代码确定性输出结构化结果，供 AI 解读；V1.0.5 补齐 3 种起卦方式时复用后端

### 3.3 核心设计决策

1. **所有"占卜"动作收敛在 AI 对话页**：抽签/解梦/八字/梅花易数都是"对话页 + 不同意图"，1 人只需要做一个对话页的交互。梅花易数结果用专用 4 宫格卡片组件（`MeihuaResultCard`）呈现，和抽签的"签文卡片 + 解读流"模式一致。
2. **计算和解读分离**：
   - **计算层**（确定性）：八字、大运、当日干支、签号、卦象、**梅花易数的本/互/变/卦中卦 + 体用生克 + 应期** — 全部用代码/库算出来
   - **解读层**（AI）：把计算结果 + 用户问题塞给 DeepSeek，流式返回；梅花易数额外在解读后以"轻问一次"的形式让 AI 收集外应，融合到解读里
   - 好处：可验证、可缓存、成本可控、输出风格可调
3. **首页运势用简化版评分公式先顶上**，规则引擎 PRD 到位后只替换 `lib/fortune/scorer.ts` 一个文件。
4. **梅花易数应期规则也按"单文件可替换"设计**：`lib/meihua/ying-qi.ts` 独立封装简化规则，V1.1 有更严谨规则引擎时整块替换。

---

## 4. 数据模型

所有表开启 **RLS（行级安全）**；用户只能读写自己的数据。

### 4.1 核心表

#### `profiles` — 用户档案（支持多档案，MVP 只露一个）
```sql
id                uuid PK
user_id           uuid FK → auth.users
nickname          text
gender            text              -- 'male' | 'female'
birth_time        timestamptz       -- 精确到分
calendar_type     text              -- 'solar' | 'lunar'
birth_province    text
birth_city        text
birth_district    text
birth_longitude   numeric(9,6)      -- 真太阳时计算
birth_latitude    numeric(9,6)
current_location  jsonb
avatar_url        text
is_default        bool
created_at, updated_at
INDEX (user_id, is_default)
```

#### `bazi_charts` — 八字排盘缓存（绑 profile_id，非 user_id）
```sql
id              uuid PK
profile_id      uuid FK UNIQUE
pillars         jsonb              -- {year:{gan,zhi}, month, day, hour}
five_elements   jsonb              -- {木:2, 火:1, 土:3, 金:1, 水:1}
day_master      text
ten_gods        jsonb
favorable_gods  jsonb              -- 喜用神
luck_pillars    jsonb              -- 大运列表
solar_true_time timestamptz
raw             jsonb              -- lunar-javascript 原始输出
created_at
```

#### `fortunes` — 每日运势缓存（核心省钱点）
```sql
id              uuid PK
profile_id      uuid FK
fortune_date    date
score_overall   int
scores          jsonb              -- 7 维度分数
one_liner       text               -- AI 一句话总评
readings        jsonb              -- 7 维度详细解读
attributes      jsonb              -- 幸运色/方位/时辰等
model           text
tokens_used     int
created_at
UNIQUE (profile_id, fortune_date)
```

#### `conversations` — 对话会话
```sql
id              uuid PK
user_id         uuid FK
profile_id      uuid FK
title           text               -- AI 根据首条消息生成（≤10 字）
last_message_at timestamptz
created_at
```

#### `messages` — 对话消息
```sql
id              uuid PK
conversation_id uuid FK
role            text               -- 'user' | 'assistant' | 'system'
content         text
intent          text               -- 'chat' | 'divination' | 'dream' | 'bazi' | 'meihua'
metadata        jsonb              -- 签号/卦象/UI 指令等结构化信息
tokens_used     int
created_at
```

#### `divination_records` — 占卜/解梦/八字/梅花易数详情（关联到 message）
```sql
id              uuid PK
message_id      uuid FK UNIQUE
type            text               -- 'qianwen' | 'dream' | 'bazi' | 'meihua'
input           jsonb              -- 用户问题/梦境/数字/起卦方式等
result          jsonb              -- 签号+等级+签题 / 卦象 / 排盘结果 / 梅花(本互变+体用+应期)
ai_reading      text               -- AI 解读全文（markdown）
created_at
```

**`type='meihua'` 的 input/result 结构**（档 4）：
```json
// input
{
  "method": "time" | "number",        // V1.0 只含这两种
  "raw": { "numbers": [1,2,3], "castAt": "2026-04-24T12:30:00+08:00" },
  "userQuestion": "最近换工作合适吗",
  "waiying": "打翻了水杯"              // 外应，可空；由 AI 对话收集后落回
}
// result
{
  "benGua":   { "number": 5,  "name": "水天需", "upperWuxing": "水", "lowerWuxing": "金", "lines": [...] },
  "huGua":    { "number": ... },
  "bianGua":  { "number": ... },
  "guaZhongGua": { "number": ... },   // 档 4 加项，变卦的互卦
  "dongYao": 2,                        // 动爻位 1–6
  "tiYong": {
    "ti": "lower" | "upper",
    "yong": "upper" | "lower",
    "relation": "ti_ke_yong" | "yong_ke_ti" | "ti_sheng_yong" | "yong_sheng_ti" | "bi_he",
    "verdict": "吉" | "凶" | "平"
  },
  "yingQi": {
    "speed": "fast" | "medium" | "slow",
    "timeHint": "本周内",
    "branchHour": "戌时 19–21 点"
  }
}
```

#### `prompts` — Prompt 版本管理（零发版调优）
```sql
id              uuid PK
key             text not null      -- 'fortune.daily', 'divination.qianwen', 'dream.parse' 等
version         int not null default 1
system_prompt   text not null
user_prompt_tpl text not null      -- 含 {placeholder}
active          bool not null default true
created_at
unique (key, version)              -- 同 key 可有多版本，调优时 v1 active=false / v2 active=true
```

### 4.2 种子表（只读）

#### `divination_slips` — 100 支灵签
```sql
number          int PK             -- 1-100
level           text               -- '上上' | '上吉' | '吉' | '平' | '渐顺' | '慎行'
title           text
poem            text
readings        jsonb              -- {综合, 事业, 财运, 感情, 人际, 健康}
image_url       text               -- 可选
```
**来源**：从需求文档第 69–169 行提取为 SQL seed。

#### `hexagrams` — 64 卦种子表（梅花易数用）
```sql
number          int PK             -- 1-64（先天序，代码常量锁死）
name            text               -- 卦名，如"乾为天"
upper_trigram   text               -- 上卦："乾"|"兑"|"离"|"震"|"巽"|"坎"|"艮"|"坤"
lower_trigram   text               -- 下卦
upper_wuxing    text               -- 上卦五行："金"|"木"|"水"|"火"|"土"
lower_wuxing    text
judgment        text               -- 卦辞
image           text               -- 象辞
lines           jsonb              -- [{position:"初九",text:"..."},...] × 6 爻辞
```
**来源（W3 初决定）**：
- **优先 B**：从 npm 开源包（`iching` / `yijing` / `i-ching-npm` 等）导出 64 卦 JSON → 转成 SQL seed
- **fallback D**：若开源包数据格式不满意，从公版古籍（朱熹《周易本义》，已过版权期）手工整理

五行生克规则、体用关系表、应期时辰表等 **硬编码在代码里**（`lib/meihua/wuxing.ts` 等），不入库。

### 4.2.bis 反馈表（P3 加，运营必备）

#### `feedback` — 用户吐槽 / 反馈
```sql
id              uuid PK
user_id         uuid FK → auth.users (on delete set null)  -- 匿名也可
content         text not null check (char_length between 1 and 2000)
contact         text                                        -- 联系方式（选填）
page            text                                        -- 触发反馈的页面路径
user_agent      text
created_at
```
RLS：authenticated 可 insert（`user_id = auth.uid() or user_id is null`）；select 仅 service role。
来源：P3 P1 落表 + `/me` 吐槽按钮 + `/api/feedback` 提交入口。
运营：每周扫一次（spec 第 10 节"上线后 2 周必做"第 2 项）。

### 4.3 关键设计点

1. `bazi_charts` 跟 **profile_id** 绑，不跟 user_id 绑 — 一个账号可以给多人算八字
2. `fortunes` 按 `(profile_id, fortune_date)` 唯一 — 同一天查 N 次只生成 1 次
3. `messages` 是流水，`divination_records` 是结构化结果 — 通过 `message.metadata.divination_id` 反查原始签文/卦象，支持追问
4. RLS 统一策略：`WHERE user_id = auth.uid()` 或通过 `profile_id → profiles.user_id` 反查
5. `prompts` 表让提示词调整不用发版，运营期极其重要
6. **梅花易数不建独立表**，复用 `divination_records` + `type='meihua'`，减少表数和 RLS 策略；`hexagrams` 是只读种子表，不挂 RLS（所有用户可读）

---

## 5. AI 链路设计

### 5.1 意图路由器

```
用户消息
   ↓
[规则层] ← 匹配"我要抽灵签"等固定话术 → 命中直接路由（0 token）
   ↓ 未命中
[DeepSeek 分类]（低温度、极短 prompt，<200 tokens）
   ↓
五选一: divination | dream | bazi | meihua | chat
   ↓
分发到对应 handler
```

**规则层关键词**（命中即 0 token 直接路由）：
- `divination`：抽签 / 抽灵签 / 抽支签
- `dream`：解梦 / 我梦见 / 梦到
- `bazi`：八字 / 算命 / 命盘
- `meihua`：梅花 / 梅花易数 / 起卦 / 起一卦 / 算一卦 / 卜一卦

快捷入口点击时直接带 `?intent=xxx` 参数跳转，跳过识别。

### 5.2 Prompt 模板（落 `prompts` 表）

共 **6 个核心 prompt**：

| key | 场景 |
|---|---|
| `fortune.daily` | 每日运势 7 维度解读（JSON 输出） |
| `divination.qianwen` | 灵签解读（结合签文 + 用户问题 + 选中维度） |
| `dream.parse` | 三重维度解梦（周公 + 弗洛伊德 + 荣格） |
| `bazi.interpret` | 八字命盘解读 |
| `meihua.interpret` | 梅花易数档 4 解读（本/互/变/卦中卦 + 体用 + 应期 + 外应分支） |
| `chat.general` | 通用国学问答 |

**共同原则**：
- 年轻化、治愈向语言，禁用"厄运/大凶/倒霉"等负面词
- 把"慎行"级解读转化为"善意提醒"
- 结尾必须给可落地建议 + 温柔安抚（解梦特别强调）
- 每日运势 prompt 输出严格 JSON

### 5.3 每日运势评分公式（MVP 简化版）

```
对每个维度 (7 个)，分数 = 基础分 + 五行匹配调整 + 日柱关系调整
  基础分 = 60
  五行匹配调整 = 当日五行为喜用神 → +15；为忌神 → -10
  日柱关系调整 =
    生我（正印/偏印） → +10
    同我（比肩/劫财） → +5
    我生（食神/伤官） → +5
    我克（正财/偏财） → 财运 +15，其他 +3
    克我（正官/七杀） → 事业 +10，感情/健康 -5
  截断到 [55, 95]，7 维度取平均 = 总分
```

**输入**：`bazi_charts.day_master` + `favorable_gods` + 今日干支（lunar-javascript 实时算）
**输出**：`{ scores: {综合,事业,财运,感情,人际,健康,学业}, overall: 78 }`

**抽象**：`lib/fortune/scorer.ts` 暴露 `computeDailyScore(chart, date) → Scores`；规则引擎到位后只换这一函数。

**属性推荐（幸运色/方位/时辰）**：
- 幸运色 = 当日五行对应色
- 幸运方位 = 当日干支所属方位
- 幸运时辰 = 日柱三合时辰
- 幸运数 = 日柱地支序数
- 其他（幸运花/事物/随身物）= 按五行查静态表
- 全部可覆盖，到位后重写 `lib/fortune/attributes.ts`

### 5.4 梅花易数算法说明（档 4 · MVP 简化规则）

**起卦（V1.0 两种）**：

```
时间起卦（零输入，按用户点击瞬间）:
  lunar-javascript 取 年支序(1-12) + 月数(1-12) + 日数(1-30) + 时支序(1-12)
  上卦 = (年支+月+日) mod 8     (0 视为 8)
  下卦 = (年支+月+日+时支) mod 8
  动爻 = (年支+月+日+时支) mod 6 (0 视为 6)

数字起卦（1 / 2 / 3 个数字三种入口）:
  1 个:  上下卦都 = N mod 8, 动爻 = N mod 6    (对称起法)
  2 个:  上 = N1 mod 8, 下 = N2 mod 8, 动 = (N1+N2) mod 6
  3 个:  上 = N1 mod 8, 下 = N2 mod 8, 动 = N3 mod 6
```

**八卦序（先天）**：乾=1，兑=2，离=3，震=4，巽=5，坎=6，艮=7，坤=8
**八卦五行**：乾/兑=金，离=火，震/巽=木，坎=水，艮/坤=土

**卦推演**：

```
本卦 = 上下两卦合并成 6 爻
互卦 = 本卦 2-3-4 爻作下卦 + 3-4-5 爻作上卦
变卦 = 本卦动爻位阴阳翻转
卦中卦 = 变卦的互卦                  ← 档 4 加项
```

**体用生克判断**：

```
动爻在 1/2/3 爻 (下卦)  →  下卦=用, 上卦=体
动爻在 4/5/6 爻 (上卦)  →  上卦=用, 下卦=体

五行生克:
  相生: 金→水→木→火→土→金
  相克: 金→木→土→水→火→金

输出 relation 五选一:
  ti_ke_yong    (体克用 · 吉)
  yong_ke_ti    (用克体 · 凶)
  ti_sheng_yong (体生用 · 泄气，略不利)
  yong_sheng_ti (用生体 · 大吉)
  bi_he         (体用比和 · 平顺)
```

**应期推算（简化版）**：

```
输入: tiYong.relation + dongYao + bianGua 变爻地支
规则:
  相生类关系 (ti_sheng_yong / yong_sheng_ti)  → speed='fast',  timeHint='1-3 日内' 或 '本周内'
  比和 (bi_he)                                 → speed='medium', timeHint='本月内'
  相克类关系 (ti_ke_yong / yong_ke_ti)         → speed='slow',  timeHint='1-3 个月内'
  branchHour = 变爻地支反查时辰表（子时=23-1点, 丑时=1-3点, ...）
```

**抽象层**：`lib/meihua/ying-qi.ts` 独立文件，正式应期规则引擎到位后整块替换（同 `fortune/scorer.ts` 模式）。

**外应收集（AI 对话式，不走代码）**：
- 在 `meihua.interpret` prompt 输出末尾，若 `waiying` 为空则 AI 主动追问一句"起卦那一刻你周围有没有让你印象深刻的画面、声音或一句话？没有就说"跳过"即可"
- 用户回答后重新调一次 `meihua.interpret`（这次 waiying 有值）→ AI 输出"外应融合段"补充到原解读前面
- 外应五行归类表硬编码在 prompt system 里（水:水/液体/雨/哭/流/冷；火:火/热/红/笑/明/亮；木:花/树/绿/风/纸/长条；金:金属/白/声响/刀/圆/硬；土:土/石/黄/厚/静/方）

**`meihua.interpret` user template 输入**：

```
本卦={name}({upper_wuxing}/{lower_wuxing}), 卦辞={judgment}, 动爻={dongYao}辞={lineText}
互卦={name}, 变卦={name}, 卦中卦={name}
体用: {ti}={wuxing} / {yong}={wuxing}, 关系={relation}({verdict})
应期: {speed}, {timeHint}, 时辰={branchHour}
用户问题: {userQuestion}
{若 waiying 非空: 外应: {waiying}}
```

**输出结构**：
1. 本卦象意（3–5 句，结合卦辞和用户问题）
2. 体用 + 变化解读（4–6 句，讲体用关系、变卦指向、卦中卦暗示）
3. 应期 + 行动建议（2–3 句，具体时间 + 落地动作）
4. 若有外应 → 插一段"外应融合"（2–3 句）；若无外应 → 末尾追加一句轻问

**输出调性**（和其它 prompt 共同原则）：年轻化、治愈向；把"凶/相克"转化为"善意提醒/需要留神"；禁用"大凶/倒霉/厄运"等字眼；结尾必给可落地建议。

### 5.5 AI Gateway 封装

```ts
// lib/ai/client.ts
async function chat({
  intent,          // 选 prompt key + 记录
  variables,       // 填充模板
  stream = true,
  userId,          // token 统计 + 限流
  conversationId,  // 挂消息
}): Promise<ReadableStream | string>
```

内置：
- 流式透传（Vercel AI SDK `streamText`）
- 失败重试 + 降级（超时/限流返回友好 fallback 文本）
- Token 统计（写入 `messages.tokens_used`）
- 用户级限流（每用户每小时 30 条）

---

## 6. 前端架构

### 6.1 路由/页面（MVP 范围）

| 路径 | 用途 |
|---|---|
| `/` | 首页：每日运势（未填档案 → 默认分数 + CTA；已填 → 当日运势） |
| `/onboarding` | 首次建档案（3 步表单） |
| `/chat` | AI 对话主入口（招呼页 + 4 个快捷入口 + 输入框） |
| `/chat/[sessionId]` | 具体对话 |
| `/fortune/[date]` | 运势详情（MVP 只做单日详情；周/月切换在 V1.1） |
| `/me` | 我的 |
| `/me/profile` | 编辑档案 |

### 6.2 目录结构

```
app/
├── layout.tsx
├── page.tsx                     -- /
├── onboarding/page.tsx
├── chat/
│   ├── page.tsx
│   ├── [sessionId]/page.tsx
│   └── _components/
│       ├── ChatWindow.tsx
│       ├── MessageList.tsx
│       ├── QuickActions.tsx
│       ├── SlipAnimation.tsx    -- 摇签 Lottie
│       ├── SlipResultCard.tsx
│       ├── MeihuaInputCard.tsx  -- 梅花起卦方式选择器（V1.0 时间/数字 亮；其它 3 种 V1.0.5 灰占位）
│       ├── MeihuaResultCard.tsx -- 梅花 4 宫格卦象卡（本/互/变/卦中卦 + 体用 + 应期）
│       └── HistoryDrawer.tsx
├── fortune/[date]/page.tsx
├── me/
│   ├── page.tsx
│   └── profile/page.tsx
└── api/
    ├── chat/route.ts            -- SSE 流式对话
    ├── fortune/daily/route.ts
    ├── divination/qianwen/route.ts
    ├── divination/dream/route.ts
    ├── divination/bazi/route.ts
    ├── divination/meihua/route.ts  -- 起卦 + 推演（返回 result 给前端渲染 Card；解读走 /api/chat SSE）
    └── profile/route.ts

components/
├── ui/                          -- shadcn 原子组件
├── DatePicker.tsx               -- 公历/农历双轨
├── RegionPicker.tsx             -- 省市区 + 经纬度
└── AvatarUpload.tsx

lib/
├── ai/
│   ├── client.ts                -- DeepSeek gateway
│   ├── prompts.ts
│   └── intent.ts
├── bazi/
│   ├── chart.ts                 -- lunar-javascript 封装
│   ├── solar-time.ts            -- 真太阳时
│   └── stems-branches.ts
├── fortune/
│   ├── scorer.ts                -- 7 维度评分（可替换）
│   └── attributes.ts            -- 幸运色/方位/时辰
├── divination/
│   ├── slips.ts                 -- 从 100 支签随机抽
│   └── dream-parser.ts          -- 梦境内容校验
├── meihua/                       -- 梅花易数引擎（I4）
│   ├── hexagram-data.ts         -- 64 卦静态数据（W3 从开源包导出）
│   ├── casting/
│   │   ├── time-casting.ts      -- 时间起卦
│   │   ├── number-casting.ts    -- 数字起卦 (1/2/3 数字)
│   │   ├── random-casting.ts    -- V1.0.5 报数（V1.0 留空桩）
│   │   ├── stroke-casting.ts    -- V1.0.5 文字（V1.0 留空桩）
│   │   └── coin-casting.ts      -- V1.0.5 摇铜钱（V1.0 留空桩）
│   ├── derivation.ts            -- 互卦/变卦/卦中卦
│   ├── wuxing.ts                -- 五行生克规则
│   ├── ti-yong.ts               -- 体用判断
│   ├── ying-qi.ts               -- 应期推算（单文件可替换）
│   └── index.ts                 -- castAndAnalyze(input) → result
├── supabase/
│   ├── client.ts                -- 浏览器
│   ├── server.ts                -- 服务端（cookie）
│   └── admin.ts                 -- service role
└── utils/

db/
├── migrations/
├── seed/
│   ├── 100_slips.sql            -- 从需求文档提取
│   └── 64_hexagrams.sql         -- W3 从 npm 开源包导出（梅花易数）
└── rls/                         -- 行级安全策略

types/
└── database.ts                  -- Supabase 自动生成类型
```

### 6.3 状态管理原则

**尽量别引新库**：
- 服务端状态：Server Components 直连 Supabase
- 对话流式：`useChat` (Vercel AI SDK)
- 表单：`react-hook-form` + `zod`
- 局部 UI：`useState`
- 全局唯一状态：当前 `profileId`（React Context + cookie 持久化）

### 6.4 关键交互

**(1) 首页运势流程**
```
<HomePage> (Server Component)
  读 profile (cookie 里的 profileId)
    ├─ 无 → 默认分数 + onboarding CTA
    └─ 有 → 查 fortunes (profile_id, today)
        ├─ 命中 → 渲染缓存
        └─ 未命中 → 调 /api/fortune/daily 生成 + 写缓存 + 渲染
```
首屏 SSR、无客户端 loading 闪烁。

**(2) 对话流式（抽签示例）**
```
用户 "我要抽灵签" → POST /api/chat (SSE)
  服务端 classifyIntent → 'divination'
  → 返回 "好，选主题" + 6 按钮 (via message.metadata.ui)
  用户选"事业学业" → 追问 "描述你的问题"
  用户描述 → 随机 slip + AI 流式解读
  前端：摇签动画 → 逐字显示解读
  结果落 divination_records
```

关键：**结构化 UI 通过 `message.metadata.ui: {type:'options', items:[...]}` 驱动前端渲染按钮**，不让 AI 直接输出按钮。

**(3) 梅花易数对话流（档 4，V1.0 时间/数字起卦）**

```
用户 "我要起个梅花卦" / 点快捷入口"梅花"
  ↓ 意图路由命中 'meihua'（规则层 0 token 直路由）
AI "好，先选起卦方式"
  ↓ 渲染 <MeihuaInputCard>  (message.metadata.ui = 'meihua_input')
用户选 "时间起卦"  → 直接提交
  或选 "数字起卦" → 卡片展开输入框 → 输 1/2/3 个数字 → 提交
  ↓ POST /api/divination/meihua  (起卦 + 推演 + 体用 + 应期)
  ↓ 服务端写 divination_records，返回 {recordId, result}
前端：
  1) 渲染 <MeihuaResultCard> (message.metadata.ui = 'meihua_result')
     展示 4 宫格 本/互/变/卦中卦 + 体用标签 + 应期提示（全是代码硬算值）
  2) 若对话历史里还没问过用户问题 → AI "你的问题是什么？" → 用户回答
  3) 把 result + userQuestion + waiying(空) 喂给 meihua.interpret → 流式出解读前 3 段
  4) 解读末尾 AI 追问："起卦那一刻你周围有没有让你印象深刻的画面、声音或一句话？没有就说'跳过'"
用户回 "打翻了水杯" 或 "跳过"
  ├─ 跳过 → AI 固定 2-3 句温柔收尾
  └─ 给了外应 → 服务端把 waiying 回填 divination_records，再调一次 meihua.interpret
               → AI 输出"外应融合"补充段
  ↓ 全部对话落 messages；最终解读写入 divination_records.ai_reading
```

4 宫格卡片视觉：卦象符号用八卦 Unicode（☰☱☲☳☴☵☶☷）大字号；每格标五行色（金白/木青/水蓝/火红/土黄）；动爻位和体/用标签高亮；应期提示小字在卡片底部。

**(4) 摇签/生成动画**
- 摇签：Lottie（`lottie-react` + 免费摇签 JSON）
- 摇铜钱（V1.0.5）：Lottie 3 枚铜钱翻转 × 6 次；V1.0 先不做
- AI loading：shadcn `<Skeleton />` + 打字机效果

**(5) 八字解读 UI 分级**
- **V1.0**：八字 M6 输出走纯文字流式（在 `/chat` 对话气泡里渲染 6 段解读），**不做 BaziChart 卡片**
- **V1.0.1**：补 BaziChart 卡（4 柱大字 + 五行计数 + 大运 row + 十神标签），按设计 §8 视觉
- 依据：1 人 5 周节奏砍 V1.0 卡片，先把八字解读"能用"摆出来；卡片是"好看"层，可后置
- 影响 task：P2 E2 在视觉走查步骤已注明文字版可接受

### 6.5 易忽略但必做的几块

- **PWA + manifest**：用户可"添加到主屏幕"（1 天工作量）
- **微信浏览器兼容**：UA 差异 / SSE 缓冲问题（见风险表）
- **敏感词过滤**：输入的梦境/测算问题需过滤
- **错误边界**：Next.js `error.tsx` 兜底

---

## 7. 交付路径（5 周 MVP）

| 周 | 目标 | 交付物 | 关键动作 |
|---|---|---|---|
| **W1** | 骨架跑通 | 能登录、能填档案、能算八字 | Next.js 初始化 / Supabase 建表 + RLS / 匿名登录 / onboarding 3 步表单 / lunar-javascript 封装 + 单测 |
| **W2** | AI 对话闭环 | `/chat` 来回对话 + 历史记录 | AI Gateway / Prompt 仓库（预留 `meihua.interpret` 行）/ `/api/chat` SSE / 对话页 UI / 意图路由规则层（含 meihua 关键词） |
| **W3** | 抽签 + 解梦 + **梅花算法层** | 走完抽签/解梦两链路 + 梅花算法单测全绿 | 100 签 + **64 卦 seed 入库** / 抽签动画 / 解梦对话式引导 / 两种 prompt 落库 / **`lib/meihua/*` 起卦(时间+数字) + 互/变/卦中卦推演 + 体用 + 应期 + 单测** / **W3 末硬 gate：找懂梅花的朋友验 5 个真实案例，≥4 个"合理"才放行** |
| **W4** | 首页运势 + 八字解读 + **梅花 prompt/API** | 首页运势 + 八字报告 + 梅花算法能 API 调通 | Scorer / Attributes / 运势缓存 / 八字解读 handler / v0.dev 出首页视觉 / `meihua.interpret` 落 prompts 表 / `/api/divination/meihua` 完成 / `MeihuaInputCard` + `MeihuaResultCard` 静态样式完成 |
| **W5** | 打磨 + **梅花 UI 联调 + 外应分支** + 上线 | Vercel 默认域名可演示，梅花流程端到端跑通 | 梅花 UI 联调（输入卡 + 结果卡 + 流式解读）/ 外应 AI 轻问分支 prompt 调优 / 敏感词 / 错误边界 / PWA / 真机测试 / 埋点（Plausible 或 Umami） |

**每周末**必须有可演示的完整用户路径；做不到就砍特性，不往后推。

**关键验证点**：
- **W1 末**：出生信息 → 完整排盘（干支/五行/十神/大运）能对上
- **W2 末**：SSE 在微信 X5 内核里能跑（不能跑要改 fetch streams）
- **W3 末**（硬 gate）：梅花算法单测全绿 + 朋友 5 案例验收 ≥4 合理。验收不过 → **立即触发降级预案**：梅花易数整体推到 V1.0.1（MVP 上线后 1 周内补），**主 MVP 5 周不延期**
- **W4 末**：能发给朋友真机试

---

## 8. 成本模型

目标 **< ¥200/月**，按 DAU 100 / MAU 1000 测算。

| 项 | 成本 |
|---|---|
| Vercel Hobby | ¥0 |
| Supabase Free | ¥0（500MB DB + 1GB Storage + 5万 MAU） |
| 域名 | ¥0（测试期用 `*.vercel.app`） |
| 短信/微信授权 | ¥0（匿名登录） |
| Storage | ¥0（Supabase Free 足够） |
| **DeepSeek** | **¥50–150** |
| **合计** | **~¥60–150/月** |

**DeepSeek 细算**（`deepseek-chat`：输入 ¥1/M，输出 ¥2/M，缓存输入 ¥0.1/M）：
- 每日运势 ¥0.004/次
- 抽签解读 ¥0.003/次
- 解梦 ¥0.0045/次
- 八字解读 ¥0.007/次
- **梅花易数解读 ¥0.008/次**（档 4 prompt 约 1.2K tokens 输入 + 600 tokens 输出；含外应则约 +¥0.003 追加一轮）
- 普通对话 ¥0.002/轮

假设 100 DAU × 5 动作 × 30 天 = 15000 次 × 均价 ¥0.0045 = **¥70/月**（梅花易数按占 10% 动作估算）。缓存命中再省 30%。

**超预算信号**：
- 单用户单日 > 100 次调用 → 限流生效
- 某 prompt 输出 > 3000 tokens → 压缩 system prompt
- 梅花易数单用户单日起卦 >20 次 → 命中 30 条/小时通用限流

---

## 9. 风险 + 缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| lunar-javascript 真太阳时对不上 | 中 | 高（八字全错） | W1 单测跑 3 个手工验证案例 |
| 微信浏览器 SSE 被缓冲 | 高 | 中（流式差） | W2 末真机测；备选 `Transfer-Encoding: chunked` + fetch ReadableStream |
| DeepSeek 限流/宕机 | 低 | 高 | AI Gateway 3 秒超时 + 友好 fallback；备选 Kimi / 百炼 |
| 运势评分公式"太假"被察觉 | 中 | 中 | AI 解读含糊化、弱化分数、强化感受；规则引擎到位后替换 |
| 100 支签文字有瑕疵 | 高 | 低 | seed 后通读一遍修错字；AI 解读再润色 |
| 梅花易数档 4 应期规则被懂行用户挑错 | 中 | 中 | W3 末找 1 位懂梅花的朋友验 5 个真实案例；上线后反馈入口持续收集；`ying-qi.ts` 独立文件，规则错可单文件替换 |
| W3 梅花算法层跑不通 → 压垮 5 周节奏 | 中 | 高 | W3 末硬 gate：验收不过立即触发降级，梅花易数整体推 V1.0.1；**不因梅花易数延期主 MVP** |
| 64 卦开源 npm 包数据不全 | 中 | 低 | W3 初先评估 3 个候选包；都不满意走 fallback D（《周易本义》公版手工整理） |
| 1 人精力枯竭 | **高** | **极高** | 每周五 review：没做完先砍特性，不加班 |

---

## 10. 上线后 2 周必做

1. **埋点**：关键漏斗（打开 → 填档案 → 首次对话 → 追问）
2. **反馈入口**：个人页加"吐槽"按钮，收集到 Supabase 表，每周扫一次
3. **Prompt 调优**：观察 `messages.content` 实际 AI 输出，改 `prompts` 表里的 system prompt（零发版）
4. **梅花易数案例复盘**：每周挑 5 个真实卦例看解读质量，重点盯应期准确度和外应融合效果

---

## 10bis. V1.0.5 计划（上线后 2–3 周补梅花易数其余 3 种起卦）

**范围**：报数起卦 / 文字起卦 / 摇铜钱起卦（含 Lottie 动画）
**工期**：≈ 1–1.5 周

| 子项 | 估算 | 依赖 |
|---|---|---|
| 报数起卦（随机 3 数 → 起卦） | 0.5 天 | `random-casting.ts` 桩文件实现；UI 只需按钮触发 |
| 文字起卦（2 汉字按笔画） | 1–1.5 天 | 集成中文笔画字典（npm `cn-kanji-strokes` 或类似） |
| 摇铜钱起卦 + Lottie 动画 | 2–3 天 | 动画素材 + 音效；6 次铜钱投掷组合 → 爻组 |
| `MeihuaInputCard` 放开 3 个灰色占位项 | 0.5 天 | 上面三项完成后开灯 |
| 回归测试 | 1 天 | 5 种方式全跑一遍；确认和 V1.0 档 4 解读链路兼容 |

**前置条件**：V1.0 算法层已支持（`lib/meihua/*` 的 `casting/` 桩文件只需补实现，其它推演/体用/应期层代码 0 改动）。

**上线后用户感知**：`MeihuaInputCard` 5 种方式全部亮起，呈现"功能完整"。

---

## 11. V1.1 回补清单

按优先级从高到低：

1. 八字规则引擎对接（等 PRD 到）— 替换 `scorer.ts`
2. 多档案切换 UI（数据模型已支持）
3. 微信授权登录 + 手机号绑定/换绑
4. 周/月运势详情
5. 精准解梦表单（4 字段）
6. 梅花易数档次升级（档 4 → 更完整，含更严谨应期规则引擎）— 替换 `lib/meihua/ying-qi.ts`
7. 每日运势定时推送
8. 语音输入（ASR）
9. 会员/解锁未来运势
10. 塔罗牌
11. 自定义域名 + ICP 备案 + Cloudflare 前置

---

## 12. 下一步

✅ **已完成**：三份实现计划 + 14 单元视觉 prompt 包

| 阶段 | 文件 | 范围 | 工时 |
|---|---|---|---|
| P1 骨架 | `docs/superpowers/plans/2026-04-24-qingyun-ai-p1-skeleton.md` | W1–W2 · 38 task · Next.js + Supabase + 八字 + AI Gateway + onboarding + 对话基础 + 素笺仙气视觉系统 | 70.5h |
| P2 功能 | `docs/superpowers/plans/2026-04-24-qingyun-ai-p2-features.md` | W3–W4 · 5 功能闭环 + 梅花 V1.0 + W3 gate + `/fortune/[date]` | ~74h |
| P3 上线 + V1.0.5 | `docs/superpowers/plans/2026-04-24-qingyun-ai-p3-launch.md` | W5 上线 + 上线后 W6–W7 · 梅花对话流 + 外应 + 上线必备三件套 + 14 单元终态视觉 gate + V1.0.5 三种起卦 | 47h |
| **总计** | | **85 task** | **~191h ≈ 24 工作日** |

| 设计资产 | 文件 |
|---|---|
| 视觉 prompt 包（14 单元）| `docs/superpowers/designs/prompts-all-pages.md` |
| MeihuaResultCard 最终 mockup | `docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html` |
| 6 方向视觉对比存档 | `docs/superpowers/designs/meihua-result-card-20260424/comparison.html` |

**待 user 输入项**（执行前需要 user 提供）：
- 八字测试用例 ground truth：3 个权威 App 排盘结果（P1 Task C1）
- Supabase 项目 + DeepSeek API key（P1 B1 + A4）
- Vercel + GitHub 仓库（P1 A4）
- 梅花 W3 gate 验收人（懂梅花的朋友 1 位）

**执行入口**：选 subagent-driven（推荐）或 inline，从 P1 Section A → S → B → C/F 并行 → D → E → G → H 推进。
