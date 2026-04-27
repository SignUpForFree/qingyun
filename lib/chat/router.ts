import "server-only";
import { desc, eq } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { chat } from "@/lib/ai/client";
import { buildPromptMessages, K_RECENT } from "@/lib/ai/summarizer";
import { serializeJson } from "@/lib/db/json";
import { profiles } from "@/lib/db/schema";
import type { Intent } from "@/types/domain";
import { frame, safeEnqueue } from "./sse";

export const SYSTEM_PROMPT = [
  "你是轻运 AI，一位温柔、年轻化的国学陪伴助手。",
  "回复风格：自然、简短（默认 80–200 字），有温度但不端说教架子。",
  "禁用：大凶 / 倒霉 / 厄运 / 命中注定 等绝对负面词。把不利信号转成『适合静一静』、『可以慢一点』这类柔和说法。",
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

/** 用户是否有任意 profile（A3 模式：八字/梅花需要显式选） */
async function userHasAnyProfile(userId: string): Promise<boolean> {
  const db = getDb();
  const hit = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .limit(1);
  return Boolean(hit[0]);
}

/** 列出用户档案（profile_picker 卡用） */
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
      const has = await userHasAnyProfile(userId);
      if (!has) {
        return { contentText: "请填写八字信息", meta: { ui: "bazi_quick_form" } };
      }
      // A3 模式：先选档案
      const userProfiles = await listUserProfiles(userId);
      return {
        contentText: "用谁的档案算八字？",
        meta: {
          ui: "profile_picker",
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
      const has = await userHasAnyProfile(userId);
      if (!has) {
        return { contentText: "请先填写八字信息", meta: { ui: "bazi_quick_form" } };
      }
      const userProfiles = await listUserProfiles(userId);
      return {
        contentText: "用谁的档案起卦？",
        meta: {
          ui: "profile_picker",
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

  await db.insert(messages).values({
    conversation_id: args.conversationId,
    role: "assistant",
    content: assistantText || "(无内容)",
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
