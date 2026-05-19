# P1 视觉基线走查报告

> **日期**：2026-04-26
> **基准**：`docs/superpowers/designs/prompts-all-pages.md` §0 全局设计语言"素笺仙气 Su Jian Xian Qi"
> **截图存档**：`test-results/visual-baseline/*.png`（10 张：5 页 × desktop + iPhone 14）
> **复跑**：`pnpm exec playwright test e2e/visual-baseline.spec.ts`

## 检查结论：**通过** ✓

5 个 P1 页面在 desktop（1280×800）+ iPhone 14（393×852）两个视口下，都符合"素笺仙气"全局规范。下表逐项核对。

## 全局规范

| 规范项 | desktop | iPhone | 备注 |
|---|---|---|---|
| Noto Serif SC 标题 + ritual2 字距 | ✓ | ✓ | h1/h2 都用 serif |
| Noto Sans SC 正文 | ✓ | ✓ | body 默认 |
| 三层 mist 背景（#FFE8F0 / #E8E4FF / #E4F0FF） | ✓ | ✓ | globals.css fixed |
| GlassCard rgba(255,255,255,0.7) backdrop-blur 20px | ✓ | ✓ | 各页主卡 |
| hairline 0.5px lavender 边框 | ✓ | ✓ | GlassCard 默认带 |
| 墨紫 #4A3D5C 主文本 | ✓ | ✓ | --color-ink-plum |
| 雾紫 / 雾灰紫 副文本 | ✓ | ✓ | --color-ink-mist / fade |
| ✦ ✧ Sparkle 装饰 | ✓ | ✓ | 标题旁 / Divider 中心 / BottomNav active |
| 淡紫粉渐变 CTA 按钮 | ✓ | ✓ | F0B8C8 → C9A1D9 |
| BottomNav 3 tab（首页/对话/我的） | ✓ | ✓ | sticky 底部 + glass |

## 逐页核对

### `/` 首页（未建档态）

- ✓ 中央 GlassCard：标题 "福小运 ✦" + 副文 + Divider + 隐私一句话 + "开始建档"渐变 CTA
- ✓ 4 个 WatercolorDot 装饰点（lavender / pink / blue 三色，模糊 8px）
- ✓ AppHeader 顶部 "福小运" serif tracking-ritual2
- ✓ BottomNav 底部 3 tab，"首页"为 active
- desktop 居中布局留白合理；iPhone 单卡撑满宽度

### `/onboarding` Step 1（昵称 + 性别）

- ✓ 顶部 ●●○ 进度点（淡紫粉渐变第 1 个填充，2/3 空圆）
- ✓ "STEP 1 / 3" 11px serif tracking-ritual3 雾紫
- ✓ "你 是 谁 ✦" 22px serif tracking-ritual2 墨紫
- ✓ 副文 "先认识一下，简单两步"
- ✓ 性别 segmented control 男/女 双方块（未选时白底 hairline，选中时淡紫粉渐变 + shadow-pill）
- ✓ "下一步" CTA 渐变 + serif 15px white tracking-ritual

### `/chat` 招呼页

- ✓ AppHeader "对 话" + 左 hamburger（HistoryDrawer 触发器）
- ✓ 招呼 GlassCard "今天，想聊点什么 ✦" + 副文
- ✓ Divider 渐隐分隔线 + 中心 ✦
- ✓ "随手挑一个" 标小 11px tracking-ritual3 雾紫
- ✓ QuickActions 2×2 网格：抽签（fire 暖粉）/ 解梦（water 冷蓝）/ 八字（earth 暖杏）/ 起卦（wood 嫩绿）
  - 每卡 GlassCard + 对应五行 30% alpha 底色 + 标题 + ✦ + hint 副文
- ✓ 底部 ChatInput pill：圆角 textarea + 渐变 send 按钮

### `/chat/new` 会话页（空态）

- ⚠ **空消息列表是大片空白**（仅有 AppHeader + ChatInput + BottomNav）
  - 问题：没有任何引导文本，对新用户不友好
  - 建议：MessageList 的 `empty` slot 在这里传一个 GlassCard "随便聊聊吧"
  - 优先级：低（W2 D1 接通 SSE 后用户会立刻看到流式回复，空态时间窗很短）

### `/me` 未建档态

- ✓ "还 没 有 档 案 ✦" GlassCard + "去建档" CTA
- ✓ 4 行 MenuList：编辑档案 / 历史记录（启用，链接到 /onboarding 和 /chat）
  + 吐槽反馈 / 关于福小运（disabled 灰显示 + 标注 "P3 P1 实装" / "占位"）
- ✓ 行间渐隐 hairline 分隔
- ✓ 页脚 "福小运 · 1 人 5 周 MVP · v0.1" 居中 10px 雾紫

## 已知小调整建议（可选）

| 优先级 | 项 | 文件 | 修法 |
|---|---|---|---|
| 低 | `/chat/new` 空态加引导文 | `app/chat/[sessionId]/page.tsx` | 传 `empty` slot 给 MessageList |
| 低 | onboarding Step 1 → Step 2 → Step 3 进度点同步动画 | `_components/StepIndicator.tsx` | 已用 transition-all 300ms，OK，不改 |
| 极低 | iPhone 14 SafeArea bottom 适配（home indicator 下） | `app/layout.tsx` | 加 env(safe-area-inset-bottom) padding-bottom |

## 下次走查触发条件

- F4-F5 实装真实 onboarding 提交 → 跑 Step 2 + Step 3 截图
- C 运势卡（P2 第一个功能）落地 → 替换 `/` 已建档态截图
- G1 接 DEEPSEEK_API_KEY 后跑通流式 → 重截 `/chat/new` 含真实对话
