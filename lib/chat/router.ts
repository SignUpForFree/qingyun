import "server-only";
import { desc, eq } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { chat } from "@/lib/ai/client";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { buildPromptMessages, K_RECENT } from "@/lib/ai/summarizer";
import { serializeJson } from "@/lib/db/json";
import { profiles } from "@/lib/db/schema";
import type { Intent } from "@/types/domain";
import { frame, safeEnqueue } from "./sse";

/**
 * chat router 全局 system prompt
 *
 * M3.29 — 与 lib/ai/prompts/{slip,fortune-reading,bazi,meihua}-interpret.ts
 * 共享同一禁词锁集合（大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然），
 * 闲聊场景多两词「慎行 / 凶险」不强制（聊天可能讨论天气/学习等中性话题）。
 */
export const SYSTEM_PROMPT = [
  "你是轻运 AI，一位温柔、年轻化的国学陪伴助手。",
  "回复风格：自然、简短（默认 80–200 字），有温度但不端说教架子。",
  "禁用 Markdown 标题（# / ## / ###）和加粗符号（** / __）；段落直接用纯文本，不要带任何标签前缀。",
  "禁用：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然 等绝对负面词。把不利信号转成『适合静一静』、『可以慢一点』、『先慢一步』、『沉住气』这类柔和说法。",
  "结尾不要硬贴『加油』、『相信自己』这种空洞鸡汤。",
].join("\n");

interface GuideCard {
  contentText: string;
  meta: { ui: string; [k: string]: unknown };
}

const SLIP_TYPE_OPTIONS = [
  { key: "综合运势", label: "综合运势" },
  { key: "事业学业", label: "事业学业" },
  { key: "财运", label: "财运" },
  { key: "感情姻缘", label: "感情姻缘" },
  { key: "人际贵人", label: "人际贵人" },
  { key: "平安健康", label: "平安健康" },
];

const BAZI_FOCUS_OPTIONS = SLIP_TYPE_OPTIONS;

/** 列出用户档案（profile_picker 卡用 / 单档案 fast-path 检测用） */
async function listUserProfiles(userId: string) {
  const db = getDb();
  return db
    .select({
      id: profiles.id,
      nickname: profiles.nickname,
      isDefault: profiles.is_default,
      gender: profiles.gender,
      birthDate: profiles.birth_date,
    })
    .from(profiles)
    .where(eq(profiles.user_id, userId));
}

/**
 * 读取会话已绑定的 profile_id（profile_picker 后由 /api/chat/set-profile 写入）。
 * 已绑定 → 后续 bazi/meihua 引导卡跳过 profile_picker，直接进 focus_picker / number_input。
 */
async function getConversationProfileId(conversationId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ profile_id: conversations.profile_id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row?.profile_id ?? null;
}

export async function buildGuideCard(
  intent: Intent,
  userId: string,
  conversationId: string,
): Promise<GuideCard> {
  switch (intent) {
    case "divination":
      return {
        contentText: "好的，您想求哪一类签？",
        meta: { ui: "slip_type_picker", options: SLIP_TYPE_OPTIONS },
      };

    case "dream":
      return {
        contentText: "请问您想快速解梦还是精准解梦？",
        meta: {
          ui: "dream_choice",
          options: [
            { key: "fast", label: "快速解梦", hint: "简单描述 快速解梦" },
            { key: "precise", label: "精准解梦", hint: "多维度场景描述 精准解读" },
          ],
        },
      };

    case "bazi": {
      const userProfiles = await listUserProfiles(userId);
      if (userProfiles.length === 0) {
        return { contentText: "请填写八字信息", meta: { ui: "bazi_quick_form" } };
      }
      // 会话已绑定档案（profile_picker 选过 / set-profile 写过） → 跳过选择器
      const boundProfileId = await getConversationProfileId(conversationId);
      const boundExists = boundProfileId
        ? userProfiles.some((p) => p.id === boundProfileId)
        : false;
      // 单档案 fast-path 或 已绑定档案：直接进 focus_picker
      if (userProfiles.length === 1 || boundExists) {
        const profileId = boundExists ? boundProfileId! : userProfiles[0]!.id;
        return {
          contentText: "您想从哪个角度看八字？",
          meta: {
            ui: "bazi_focus_picker",
            profileId,
            options: BAZI_FOCUS_OPTIONS,
          },
        };
      }
      // 2+ 档案 + 未绑定 → A3 模式显式选档案
      return {
        contentText: "用谁的档案算八字？",
        meta: {
          ui: "profile_picker",
          intent: "bazi",
          profiles: userProfiles.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            isDefault: Boolean(p.isDefault),
            gender: (p.gender ?? "other") as "male" | "female" | "other",
            birthDate: p.birthDate ?? undefined,
          })),
          conversationId,
          allowAddNew: true,
        },
      };
    }

    case "meihua": {
      const userProfiles = await listUserProfiles(userId);
      if (userProfiles.length === 0) {
        return { contentText: "请先填写八字信息", meta: { ui: "bazi_quick_form" } };
      }
      // 会话已绑定档案 → 跳过选择器
      const boundProfileId = await getConversationProfileId(conversationId);
      const boundExists = boundProfileId
        ? userProfiles.some((p) => p.id === boundProfileId)
        : false;
      // 单档案 fast-path 或 已绑定档案：直接进报数环节
      if (userProfiles.length === 1 || boundExists) {
        const profileId = boundExists ? boundProfileId! : userProfiles[0]!.id;
        return {
          contentText: "请报 3 个 1-999 之间的随机数（也可只报 1-2 个）",
          meta: {
            ui: "meihua_number_input",
            profileId,
            numberCount: 3,
          },
        };
      }
      return {
        contentText: "用谁的档案起卦？",
        meta: {
          ui: "profile_picker",
          intent: "meihua",
          profiles: userProfiles.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            isDefault: Boolean(p.isDefault),
            gender: (p.gender ?? "other") as "male" | "female" | "other",
            birthDate: p.birthDate ?? undefined,
          })),
          conversationId,
          allowAddNew: true,
        },
      };
    }

    default:
      return { contentText: "", meta: { ui: "text" } };
  }
}

/**
 * 写引导卡 message + emit SSE 'card' 事件
 *
 * 不分意图，只要 buildGuideCard 给了 meta 就写卡。controller 已被 sse heartbeat 守护，
 * enqueue 走 safeEnqueue 防 already-closed。
 */
export async function writeAndStreamCard(args: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  conversationId: string;
  intent: Intent;
  card: GuideCard;
}): Promise<void> {
  const db = getDb();
  const [card] = await db
    .insert(messages)
    .values({
      conversation_id: args.conversationId,
      role: "assistant",
      content: args.card.contentText,
      intent: args.intent,
      metadata: serializeJson(args.card.meta),
    })
    .returning();

  safeEnqueue(
    args.controller,
    frame("card", {
      id: card?.id,
      role: "assistant",
      content: args.card.contentText,
      metadata: serializeJson(args.card.meta),
    }),
  );
}

/**
 * 流式 chat 回复 — 多轮对话 (intent === 'chat')
 *
 * 按 K_RECENT 取近 K 条历史 + summary 拼 prompt，调 AI stream，
 * SSE token 推送，结束后写 assistant message。
 */
export async function streamChatReply(args: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  conversationId: string;
  userId: string;
  text: string;
  /** 客户端断流时 abort，透传给 chat() 让上游 DeepSeek 取消（防 token 浪费） */
  abortSignal?: AbortSignal;
}): Promise<void> {
  const db = getDb();
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, args.conversationId))
    .limit(1);

  const recentRows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversation_id, args.conversationId))
    .orderBy(desc(messages.created_at))
    .limit(K_RECENT + 1);

  const recentExclSelf = recentRows
    .slice(1)
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const prompt = buildPromptMessages({
    systemPrompt: SYSTEM_PROMPT,
    summary: conv?.summary ?? null,
    recent: recentExclSelf,
    userText: args.text,
  });

  const modelMessages: ModelMessage[] = prompt
    .slice(1)
    .map((m) => ({ role: m.role, content: m.content }) as ModelMessage);

  const stream = await chat({
    messages: modelMessages,
    systemPrompt: SYSTEM_PROMPT,
    stream: true,
    meta: { conversationId: args.conversationId, userId: args.userId },
    abortSignal: args.abortSignal,
  });

  let assistantText = "";
  let tokens = 0;
  for await (const chunk of stream.textStream) {
    assistantText += chunk;
    if (!safeEnqueue(args.controller, frame("token", chunk))) {
      // 流被 cancel 了，停止读 stream
      break;
    }
  }
  try {
    tokens = (await stream.usage).totalTokens ?? 0;
  } catch {
    /* usage 抓不到不致命 */
  }

  // 持久化前清扫 Markdown 装饰 + 禁词兜底（流式 token 已经吐给客户端，这一层
  // 只保证落库 / 历史回看不会留下 ###标题 / **加粗** 残留）
  const sanitized = sanitizeAiOutput(assistantText, "core");

  await db.insert(messages).values({
    conversation_id: args.conversationId,
    role: "assistant",
    content: sanitized.cleaned || "(无内容)",
    intent: "chat",
    tokens_used: tokens,
  });
}

export interface RouteIntentArgs {
  controller: ReadableStreamDefaultController<Uint8Array>;
  conversationId: string;
  userId: string;
  text: string;
  intent: Intent;
  /** 客户端断流时 abort，透传到 streamChatReply → chat() 节省上游 token */
  abortSignal?: AbortSignal;
}

/**
 * 顶层路由 — 按 intent 分流到 chat 流式 or 引导卡
 *
 * 不发 done / error / heartbeat，由 route.ts 的 ReadableStream lifecycle 统一管。
 */
export async function routeIntent(args: RouteIntentArgs): Promise<void> {
  if (args.intent === "chat") {
    await streamChatReply({
      controller: args.controller,
      conversationId: args.conversationId,
      userId: args.userId,
      text: args.text,
      abortSignal: args.abortSignal,
    });
    return;
  }

  const card = await buildGuideCard(args.intent, args.userId, args.conversationId);
  await writeAndStreamCard({
    controller: args.controller,
    conversationId: args.conversationId,
    intent: args.intent,
    card,
  });
}
