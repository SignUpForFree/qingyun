# 福小运 · 全局设计提示词包

> **设计语言**：素笺仙气（Su Jian Xian Qi · Fairy-Misty Paper）
> **日期**：2026-04-24
> **适用范围**：V1.0 MVP 全部页面与组件
> **参考 mockup**：`docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html`

---

## 0. 全局设计语言（Design Language · 粘一次，所有页面复用）

```
DESIGN LANGUAGE · 素笺仙气 Su Jian Xian Qi

Core mood: ethereal fairy mist on soft paper. Young Chinese woman, culturally 
curious but modern, loves 小红书 古风仙气 aesthetic without the kitsch. The feel 
of a page from a 仙侠 novel printed on mulberry paper with morning fog just 
lifting — quiet, luminous, poetic, color is a whisper.

Three foundational words: 仙气 · 留白 · 宋体

BACKGROUND SYSTEM:
Three overlapping soft radial-gradient glows fading into a warm white base:
- Cherry pink #FFE8F0, top-left, ellipse 50%
- Lavender #E8E4FF, top-right, ellipse 55%
- Misty blue #E4F0FF, bottom-center, ellipse 60%
- Base: linear-gradient #FAF5FB → #FEFDFE

COLOR PALETTE:
- Primary text (墨紫): #4A3D5C
- Secondary text (雾紫): #574966
- Muted text (雾灰紫): #8A7EA0 / #6D5F7F / #A69AB8
- Accent (淡紫粉): #C9A1D9
- Verdict plum: #8B5D8B
- Bagua symbols (雾紫灰): #9B8EBF
- 5-element soft fairy tones:
  · 水 Water:  #A4B8E8 (misty blue-lavender)
  · 金 Metal:  #E8D4E8 (pearl pink)
  · 木 Wood:   #BFD9C2 (misty jade)
  · 火 Fire:   #F0B8C8 (cherry pink)
  · 土 Earth:  #E8C9A4 (warm apricot)
- Divider: rgba(196,186,221,0.5) linear fade
- Card surface: rgba(255,255,255,0.7) with backdrop-blur(20px)

TYPOGRAPHY:
- Display & chinese serif: Noto Serif SC (or 思源宋体, STSongti-SC, system serif fallback)
  · Used for titles, gua names, verdicts, and important words — signals ritual
- Body & sans: Noto Sans SC Light/Regular (or PingFang SC, Hiragino Sans GB fallback)
  · Used for meta information, dates, small labels
- Mono (rare): SF Mono / ui-monospace · Used only for numeric data rows
- Letter-spacing: wide (0.15–0.55em) on Chinese serif to add ritual breath
- Weight: prefer medium 500 for serif (not bold), light 300 for sans

VISUAL ELEMENTS:
- Sparkles ✧ ✦: soft lavender #C9A1D9, 70% opacity, size 10–14px
  · Use as titular decoration, divider markers, delicate pointers
  · Never cluster (max 2 per visual group)
- Watercolor glow dots: 18–28px blurred circles, 45–55% opacity, element-colored
  · Used above cards, titles, or section headers as ambient color
- Dividers: thin hairlines that fade at both ends + centered ✦ icon
- Borders: avoid hard borders; prefer 0.5px at 30% opacity or no border at all
- Shadows: large soft, low opacity
  · Card float: 0 20px 60px rgba(200,170,220,0.25)
  · Pill glow: 0 2px 16px rgba(201,161,217,0.3)

SPACING:
- Base unit 4px, scale: 4 / 8 / 12 / 16 / 20 / 28 / 40 / 60
- Cell inner padding: 20–28px
- Between sections: 24–32px
- Page margins: 20px on mobile

CORNERS:
- Small (badges/chips): 6–10px
- Medium (cards): 14–20px
- Large (phone surfaces): 28–40px

CONSTRAINTS:
- Mobile-first 390×844 viewport
- Whitespace is the primary design element — don't fill empty areas
- Color is a whisper, not a statement
- No black (use #4A3D5C or darker plum instead)
- No hard gradients, no heavy shadows, no pure white backgrounds
- Avoid Xiaohongshu-cute; lean toward museum-restrained
```

---

## 1. Home 首页 · `/`

**路径：** `/` · 未登录显示 onboarding CTA · 已登录显示运势
**核心：** `DailyFortuneCard` 大分 + 7 维度条 + 幸运属性

```
PROMPT — Home Page

Mobile-first 390x844 screenshot. App named 福小运 (Qingyun AI, Chinese divination 
app for young women). Follows design language: 素笺仙气 — 3-radial fairy mist 
background (cherry pink top-left, lavender top-right, misty blue bottom), warm 
white base.

LAYOUT (top to bottom):

[HEADER · 52px tall]
- Left: small logo mark — a circular stroke with a tiny ✦ inside, lavender #C9A1D9
- Center: today's date in Noto Serif SC, e.g. "丙午年 · 三月初七 · 谷雨", wide spacing
- Right: circular avatar 32px with soft shadow

[HERO · DailyFortuneCard]
- Greeting line (small, serif, lavender-gray): "清晨好, 槿言"
- Today's theme one-liner (serif, plum, 15px, 2 lines max):
  "今日适合静水流深，不宜争锋"
- Big circular score gauge, 180px diameter, centered:
  · Outer ring: soft lavender-to-pink gradient stroke 4px
  · Inner fill: semi-transparent white
  · Centered number "78" in Noto Serif SC, 52px, color #4A3D5C
  · Below number: tiny label "综合运势"
  · Optional: tiny ✧ sparkles on the top-left and bottom-right of the ring
- A single watercolor glow dot above the gauge (palette: lavender)

[7-DIMENSION BARS · small compact]
- 7 rows, each with:
  · Label left (10px, letter-spaced): 事业 / 财运 / 感情 / 人际 / 健康 / 学业 / 综合
  · Progress bar (6px tall, fully rounded, light lavender-pink gradient, 
    partially filled to score%)
  · Score number right (small mono, #8B7AA5)
- 6–8px gap between rows

[LUCKY ATTRIBUTES · 2x3 grid]
- Six pill-cards, each with tiny icon + label + value:
  · 幸运色    白色
  · 幸运方位  西方
  · 幸运时辰  戌时
  · 幸运数    7
  · 幸运花    白玉兰
  · 随身物    银饰
- Each card: rounded 12px, rgba(255,255,255,0.7) backdrop blur, 
  0.5px border at 30% opacity, small lavender ✦ icon on top-left

[BOTTOM NAV · 3 tabs]
- 首页 (home icon, active · lavender fill)
- 对话 (message circle)  
- 我的 (user)
- Height 56px, bg rgba(255,255,255,0.8) blur, top 0.5px hairline

MOOD: like opening a fresh silk page at dawn. No loud saturation. The score 
feels like it's printed in ink on paper, not rendered as a dashboard gauge.
```

---

## 2. Onboarding 建档案 · `/onboarding`

**核心：** 3 步表单 · 出生时间 / 出生地 / 性别+昵称
**进度：** 顶部细进度条 + 页面流

```
PROMPT — Onboarding (3-step form)

Mobile-first 390x844 screenshot. Onboarding screen 2 of 3 as the representative 
frame — 出生时间 Birth Time step. Follows 素笺仙气 design language (fairy mist 
background, soft lavender palette, Noto Serif SC).

LAYOUT:

[TOP · 60px]
- Back arrow (thin, lavender #8A7EA0) top-left
- Progress dots centered: ● ● ○  (two filled in lavender-pink gradient, one empty)
- Empty top-right

[TITLE BLOCK · centered]
- Small label (serif, 11px, letter-spaced 0.4em, lavender-gray): "STEP 2 / 3"
- Big title (serif, 22px, plum #4A3D5C, wide spacing 0.3em):
  "你出生那一刻"
- Subtitle (sans, 13px, muted plum, 2 lines):
  "出生时间越精准，八字解读越准确。不确定就填大概时间。"
- Tiny ✧ decoration below

[FORM FIELDS · vertical stack]
Field 1: Solar / Lunar toggle
- Two pill buttons side by side: "公历" "农历" (one active in lavender gradient)

Field 2: Date picker
- Large readable date display: "2001 年 06 月 15 日"
- Below: thin dashed line suggesting tap-to-edit
- Format serif for numbers, sans for 年月日

Field 3: Time picker
- Similar style: "14 : 23" big digits
- Tiny hint below: "不确定具体分钟，填整点即可"

Field 4: True solar time toggle (optional advanced)
- Small row: label "真太阳时校正" + info ⓘ + soft toggle switch (lavender-pink 
  gradient when on)

[BOTTOM CTA]
- Primary button: full-width 48px, rounded 14px, gradient lavender-to-pink
  Text: "下一步" (serif, 15px, white, letter-spaced 0.2em)
- Secondary link below: "跳过精准时间" (sans, 12px, muted plum)

MOOD: gentle, not demanding. Form fields feel like entries in a handmade 
notebook — data capture that feels ceremonial, not bureaucratic.
```

**变体：step 1 地点选择**（差异化 brief 简写）

```
Step 1 · 地点 variant:
- Title: "你出生在哪里"
- Fields: province / city / district cascading pickers (tap to open drawer)
- Below picker: auto-computed latitude/longitude in tiny mono font 
  "经 120.12° · 纬 30.28°" with small refresh icon
- Hint: "精确到区县即可"
```

**变体：step 3 性别+昵称**

```
Step 3 · 性别+昵称 variant:
- Title: "最后，告诉我你"
- Field 1: Gender selection — two large pill buttons "男" "女" with soft ✧ 
  decoration, the unselected one ghosted
- Field 2: Nickname text input — large serif, underline style, placeholder 
  "你想被如何称呼" in muted gray
- Primary button: "开始使用" instead of "下一步"
```

---

## 3. Chat Welcome 对话招呼页 · `/chat`（无 session）

**核心：** AI 招呼语 + 6 快捷入口卡片 + 输入框

```
PROMPT — Chat Welcome Page

Mobile-first 390x844 screenshot of the chat welcome page. Follows 素笺仙气 
design language.

LAYOUT:

[HEADER · 52px]
- Back arrow left, page title "对话" (serif, 15px, wide spacing), 
  history icon right (a small drawer/list icon, lavender outline)

[GREETING BUBBLE · assistant style]
- Avatar (left): small circle, soft lavender-pink gradient fill, 
  a tiny ✧ in white center
- Bubble (right of avatar): rgba(255,255,255,0.8) backdrop blur, 
  rounded 18px (small left corner 4px for chat-tail feel), padding 14×12,
  shadow 0 4px 20px rgba(200,170,220,0.15)
  Text in Noto Serif SC 14px plum #4A3D5C, 2 lines:
  "清晨好，我是福小运 · ✧"
  "今天想让我为你做什么？"

[QUICK ACTIONS · 2x3 grid, 6 cards]
Each card: 
  · Size: approx 110 × 95px
  · Background: rgba(255,255,255,0.7) backdrop blur
  · Border: 0.5px rgba(196,186,221,0.4)
  · Rounded: 16px
  · Contents top-to-bottom: 
    - Small 32px symbol (unicode or stylized char, element-colored)
    - Label in serif 13px plum
    - Tiny sub-label in sans 10px muted
  · Shadow: subtle 0 2px 12px rgba(200,170,220,0.1)
  · On-press: soft glow

The 6 actions:
1. 🎋 抽 灵 签   · 随心一抽       (symbol: 签 character or 🎋)
2. ☰  梅 花 起 卦 · 一事一问       (symbol: ☰ in lavender)
3. 💭 AI 解 梦    · 梦的三重解读    (symbol: small cloud)
4. 八  八 字 解 读 · 命盘与大运     (symbol: 八 character)
5. ✧  每 日 运 势 · 今日指引       (symbol: ✧)
6. 💬 通 用 问 答  · 任何国学话题   (symbol: chat bubble)

[INPUT AREA · bottom sticky]
- Rounded pill-shaped input 48px tall:
  Background rgba(255,255,255,0.9) backdrop blur
  Border 0.5px rgba(196,186,221,0.4)
  Placeholder (serif, 14px, muted plum): "把想问的写给我…"
- Right inside input: small send button (lavender-pink gradient circle 32px 
  with white arrow/✦ icon)
- Left of input: small + icon (lavender, for future voice/upload)

[BOTTOM NAV as in Home]

MOOD: friendly but ceremonial. Each quick-action card feels like a folded 
note on a desk, waiting to be picked up.
```

---

## 4. Chat Session 对话中 · `/chat/[sessionId]`

**核心：** 消息流 + 不同 role 气泡 + 中间插入各种结果卡 + 输入框

```
PROMPT — Chat Session (mid-conversation)

Mobile-first 390x844 screenshot of an active meihua divination conversation. 
Shows the rich interaction: user bubble + meihua input card + result card + 
streaming AI reading. Follows 素笺仙气.

LAYOUT:

[HEADER · 52px]
- Back arrow left
- Center: session title "梅花易数 · 槿言" in serif 14px, small clock icon + 
  "03:14" timestamp on subtitle
- Right: more-options (3 dots)

[MESSAGE STREAM · scrollable, showing last 5 messages in view]

Message 1 (user, right-aligned):
- Bubble: gradient lavender-to-pink (soft rgba 0.4 opacity over glass), 
  serif 14px dark plum, rounded 18px (small right corner 4px), padding 12×10
  Text: "帮我起一卦"

Message 2 (assistant):
- Small avatar + bubble:
  Text: "好，先选起卦方式 ✦"
- Below bubble, embedded MeihuaInputCard (see section 5)

Message 3 (user, right):
- Bubble: "用数字起卦  3 5 2"

Message 4 (assistant):
- Short bubble: "起到一卦，请看 ↓"
- Below, embedded MeihuaResultCard (compact 4-grid, per 素笺仙气 refined spec)

Message 5 (assistant, streaming, currently being written):
- Bubble showing typing state: 3 dots animated, or partial text with a cursor
  Text: "此卦水天需，体为上卦水，用为下卦金…"
  (Indicates this is streaming with a thin lavender cursor at the end)

[INPUT AREA · bottom sticky as before]
- Currently disabled-looking (slightly muted) with hint "AI 正在回应…"

MOOD: like reading a slow conversation in a tea salon. Messages feel written 
on paper slips and passed between the user and the divination host. The 
assistant messages wrap various "cards" (input selectors, result displays) 
naturally into the flow.
```

---

## 5. MeihuaInputCard 起卦方式选择器

**已决定方向：素笺仙气**
**核心：** 2 个 primary 亮 + 3 个灰色占位 + 选中数字起卦后展开输入框

```
PROMPT — MeihuaInputCard (selector)

Within a chat conversation context (shown as an embedded card in an assistant 
message bubble), design the MeihuaInputCard. Follows 素笺仙气.

DEFAULT STATE:

[CARD CONTAINER]
- rgba(255,255,255,0.75) backdrop blur, 
- border 0.5px rgba(196,186,221,0.4), 
- rounded 16px, padding 16×14, 
- soft shadow

[HEADER ROW]
- Serif 13px plum: "选 择 起 卦 方 式"
- Right: tiny ✦ icon in lavender

[PRIMARY ACTIONS · 2 buttons side by side, equal width]
Button 1: "时 间 起 卦"
- Background: white with subtle lavender-pink gradient overlay
- Border 0.5px rgba(201,161,217,0.4), rounded 12px
- Height 56px, center aligned, serif 14px plum
- Small sub-label below name: "此刻之兆" (sans 10px muted)
- Small clock icon left of label, lavender color

Button 2: "数 字 起 卦"
- Same style but subtitle: "一 / 二 / 三 个数"
- Small #-hash icon left

[SECONDARY · 3 placeholder pills, disabled/ghosted, row]
- Tiny pills each: "报数" "文字" "摇铜钱"
- Style: transparent bg, dashed border 0.5px muted, text in sans 10px muted gray
- Below these: centered hint (sans 9px lavender-gray):
  "V1.0.5 敬请期待 ✧"

[DATA ENTRY STATE · when user taps "数字起卦"]
- Number selection buttons change to:
  · Three input fields in a row, each with:
    - Small label above: "第一个" "第二个（选填）" "第三个（选填）"
    - Input: 56px square, center-aligned big serif 22px, border 0.5px 
      lavender, rounded 12px
    - Lavender cursor when focused
  · Below fields, a full-width button:
    "起 卦" (serif 14px white on lavender-to-pink gradient, rounded 12px, 
    subtle glow)

MOOD: like picking between two carved wooden cards on a fortune-teller's 
table. Options should feel equally weighted, not forced.
```

---

## 6. MeihuaResultCard · 已定

**参考文件：** `docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html`
**Brief 已详述，不重复**。使用该 HTML 作为最终规格。

---

## 7. SlipResultCard 签文结果卡

**核心：** 签号 + 等级 pill + 签题 + 签文（大字居中）+ 6 维度标签切换

```
PROMPT — SlipResultCard

Within chat context. A card displaying one drawn lingqian (灵签) result with 
its poem and readings. Follows 素笺仙气.

LAYOUT:

[CARD CONTAINER]
- rgba(255,255,255,0.8) backdrop blur
- Border 0.5px rgba(201,161,217,0.3)
- Rounded 18px, padding 22×18
- Soft shadow 0 8px 24px rgba(200,170,220,0.15)

[HEADER]
- Left: "第  八 · 十 · 六  签" (serif 15px plum, wide letter-spacing 0.2em)
  Note numerals rendered as big Chinese characters
- Right: level pill
  · "上 上" rendered in serif 11px 
  · Background: soft gradient depending on level:
    · 上上 upper-uppermost: warm rose pink gradient
    · 上吉: peach-pink
    · 吉: soft yellow
    · 平: neutral lavender
    · 渐顺: soft blue-purple
    · 慎行: muted mauve (gentle, not alarming)
  · Rounded 10px, padding 3×10

[SLIP TITLE]
- Centered serif 20px plum, letter-spacing 0.3em:
  "天 官 赐 福"
- Tiny ✧ decorations on both sides

[POEM BLOCK]
- Centered, 4 lines, serif 15px plum, letter-spacing 0.15em, 
  line-height 2.2
  "灵 签 第 一 最 为 上"
  "富 贵 荣 华 百 事 昌"
  "若 问 求 财 皆 遂 意"
  "更 兼 疾 病 保 安 康"
- A thin watercolor glow beneath (lavender, 40% opacity, heavily blurred) 
  for ambient luminance

[DIVIDER with ✦]

[DIMENSION TABS]
- 6 tabs horizontal: 综合 · 事业 · 财运 · 感情 · 人际 · 健康
- Active one has lavender underline 2px + plum text
- Others: muted gray, no decoration
- Small tab size 11px serif

[READING CONTENT · for active tab]
- 3–4 paragraphs of AI-interpretation in sans serif 13px, 
  color #4A3D5C, line-height 1.85
- First paragraph prepended with a small ✦ symbol as marker
- Paragraph 2–3 have subtle indentation

[FOOTNOTE (optional)]
- Small sans 10px muted: "问题：最近换工作合适吗"
- Right aligned, italic-like mood

MOOD: like unfolding an actual fortune slip from a temple. The poem should 
feel weighty — the reading below feels like the temple's resident interpreter 
softly explaining it to you.
```

---

## 8. BaziChart 八字排盘卡（在对话里展示）

**核心：** 4 柱干支大字 + 日主 + 五行分布 + CTA

```
PROMPT — BaziChart Card (in-chat)

Card displaying a user's full bazi chart, shown in chat when user asks for 
八字解读. Follows 素笺仙气.

LAYOUT:

[HEADER]
- Serif 13px letter-spaced "命  盘"
- Subtitle sans 10px muted: "槿言 · 丁丑年 三月初七 辰时"

[FOUR PILLARS · row of 4 columns]
Each column:
  · Top tiny label (sans 10px lavender): 年 柱 / 月 柱 / 日 柱 / 时 柱
  · Middle: big serif heavenly-stem character 24px plum with watercolor 
    glow behind it (color per stem's element)
  · Below: big serif earthly-branch character 20px plum
  · Bottom: tiny sans text "伤官" / "正印" etc (ten-gods label, 9px muted)

Example content:
年柱 丁(火) 丑(土) · 伤官
月柱 甲(木) 辰(土) · 正印
日柱 己(土) 未(土) · 日主
时柱 戊(土) 辰(土) · 劫财

[FIVE-ELEMENT DISTRIBUTION]
- Horizontal bar chart, 5 segments with element colors (金/木/水/火/土)
- Segment width = element count in chart
- Label below each segment: "木 2  火 1  土 4  金 0  水 0" (mono or serif)
- Element labels in very small serif, color-tagged

[DAY-MASTER + FAVORABLE GODS]
- One line in serif 12px: "日 主：己 土  ·  喜 用 神：火、木"
- Plum color with gentle lavender backdrop badge

[CTA BUTTON]
- Full-width: "读 · 细 说 命 盘" (serif 14px white on lavender-pink gradient, 
  rounded 12px)

MOOD: like looking at a bound ancestral record book. Data is the hero — 
decoration is almost nonexistent, but the serif + wide spacing + soft color 
give it reverence.
```

---

## 9. Me 我的页 · `/me`

**核心：** 头像 + 档案 + 入口列表

```
PROMPT — Me Page

Mobile-first 390x844. Profile / settings landing page. Follows 素笺仙气.

LAYOUT:

[HEADER · 52px]
- Page title "我 的" (serif 15px wide-spaced) center
- Settings gear icon right (lavender outline)

[PROFILE HEADER · 120px tall]
- Background: very soft lavender-to-pink gradient fading into the page 
  background (no hard edge)
- Avatar 72px circular, soft shadow, bottom-left anchored with 20px margin
- Right of avatar:
  · Big serif 18px nickname: "槿言"
  · Sub sans 11px muted: "丁丑年 · 三月初七 生"
  · Tiny pill: "女  ·  东方"

[QUICK STATS · 3 cards horizontal]
- Total conversations / lingqian drawn / days using
- Each card: 1 big serif number + 1 tiny label underneath
- Style: white-70 backdrop blur, 10px rounded, border 0.5px lavender-20

[ENTRY LIST · vertical, separated by hairlines with ✦]

Each row (48px tall):
- Small icon left (lavender outline stroke 1.5px)
- Serif 14px label plum
- Right: chevron > in muted lavender

Rows:
· 编 辑 档 案     · 出生信息 / 头像 / 昵称
· 历 史 记 录     · 过往占卜与对话
· 吐 槽 反 馈     · 告诉我们想法
· 关 于 福 小 运     · 版本 / 免责声明

[FOOTER · tiny]
- Version number + "诚心者得吉兆" tagline in tiny sans 10px muted

[BOTTOM NAV as before, with 我的 tab active]

MOOD: a personal memory corner. Warm but restrained. Not a "dashboard", 
more a "pressed flower notebook cover page".
```

---

## 10. ProfileEdit 编辑档案 · `/me/profile`

**核心：** 复用 onboarding 的表单控件，多一个头像上传

```
PROMPT — Profile Edit Page

Similar to Onboarding but as a single-page flat form for editing. Title 
"编 辑 档 案". No progress dots. Follows 素笺仙气.

Top: avatar with a small pencil-edit badge for upload.
Form sections (each with a small serif section title + hairline below):
  · 基础资料  (nickname, gender)
  · 出生资料  (solar/lunar, date, time, true-solar-time toggle)
  · 出生地    (province/city/district, auto-computed lat/lng)
Bottom: large primary button "保 存 修 改" lavender-pink gradient.

A subtle note at the very bottom (sans 10px muted plum):
"修改出生资料会重新计算八字与喜用神"
```

---

## 11. FortuneDetail 运势详情页 · `/fortune/[date]`

**核心：** 展开版的 DailyFortuneCard + AI 每维度长解读

```
PROMPT — Fortune Detail

Full-screen version of the daily fortune with expanded AI reading per 
dimension. Mobile-first, 素笺仙气 palette.

Top: date navigation (← yesterday · today · tomorrow →) with small calendar icon.
Middle: hero fortune gauge (bigger 220px) + one-liner from AI.
Below: tabbed sections for each dimension (综合/事业/财运/感情/人际/健康/学业), 
  each tab when active shows:
  · Small bar for that dimension's score
  · 3–5 paragraph AI reading in sans serif, spaced generously
  · A small "今日动作" block: 1 bullet point (bold serif) "不宜" + 
    "宜" sections, list style

Lucky attributes section from Home expanded: each attribute has a short 
one-sentence explanation below its value (why this color, why this 
direction based on today's stem-branch).

Bottom: tiny share button (as ✦ icon) for future V1.1.

MOOD: gentle longread, like reading a personal letter from the host of 
a Chinese tea ceremony.
```

---

## 12. Global Header & BottomNav

```
PROMPT — Global Navigation

HEADER (52px tall, sticky):
- Background rgba(255,253,254,0.85) with backdrop-blur(18px)
- Bottom border: 0.5px rgba(196,186,221,0.3)
- Height 52px safe-area-aware on top
- Content depends on page (back arrow + title + action icons)

BOTTOM NAV (56px tall, sticky):
- Background rgba(255,253,254,0.9) with backdrop-blur(20px)
- Top border: 0.5px rgba(196,186,221,0.3)
- 3 tabs equally spaced: 首页 · 对话 · 我的
- Each tab: icon (24px outline style, stroke 1.5px) + label below (sans 9px)
- Active state: icon fills with lavender-pink gradient; label lavender plum
- Inactive: muted gray #8A7EA0
- Small ✦ floats above active tab as indicator
```

---

## 13. 加载态 & 错误态（Loading / Error States）

```
PROMPT — Loading

In-card loading: 3 small watercolor glow dots (lavender, pink, jade) 
animating in a gentle up-and-down wave. Surrounded by small serif text 
"推 演 中…" with letter-spacing.

Full-page loading: centered, larger version, with a rotating ✦ sparkle 
above the dots.

PROMPT — Error

Soft tone: no red, no exclamation. Use warm pearl pink glow dot + serif 
text in plum. Example:
"小 恙  ·  请 稍 后 再 试"
"ERR: rate_limited" (tiny mono 10px beneath)

An outlined button "重 试" in plum, rounded 12px.
```

---

## 14. 动画规范（Animation Guide）

```
PROMPT — Animation

Global principles:
- All transitions ease-out cubic, 350ms default
- No bouncy overshoot, no spring physics (too playful)
- Watercolor glow dots have a gentle 4s breathing cycle 
  (opacity 0.4 ↔ 0.7)
- Sparkles ✧ have an optional 6s slow rotation

Specific scenes:
1. 摇签 Shake-draw: slip falls from top with slight tilt + fade; 
   background briefly dims to misty purple; 2 sparkles float in from 
   corners on completion.
2. 起卦 Cast: 4-grid MeihuaResultCard cells stagger-fade in 
   (60ms delay each, 300ms each).
3. 运势分数 Score: animated count-up 0 → N over 1.2s with ease-out; 
   ring stroke animates clockwise in the same timing.
4. 模式切换 Mode switch (like MeihuaInputCard number-entry): 
   soft collapse-expand 250ms, no content jump.
```

---

## 使用建议

- 每个 section 可**独立 copy** 到图像生成工具。全局语言（section 0）**必须先粘**才有一致性。
- 模型推荐顺位：**gpt-image-1 > Gemini 2.0 Flash Image > 国内文生图 > Midjourney（只给氛围参考，中文会糊）**
- 落地时：每份 brief 同时是**写 tsx 组件的 design spec**，颜色 hex 直接可用，shadow/radius 数字直接当 Tailwind 任意值 `rounded-[14px]` `shadow-[0_2px_16px_rgba(201,161,217,0.3)]`
- 若要统一感知：**先做 6–10 张关键页的图像** → 扒色板/字体 → 再落代码；如果图生成不稳，直接用 `a-refined-fairy.html` 作参考基准写代码也行

## 配套资产

- `docs/superpowers/designs/meihua-result-card-20260424/a-refined-fairy.html` — 已有 HTML mockup，**最终规格**
- `docs/superpowers/designs/meihua-result-card-20260424/comparison.html` — 6 方向对比存档

## 变更记录

- 2026-04-24: 初版 · 定 "素笺仙气" 为 V1.0 全局设计语言
