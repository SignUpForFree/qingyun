import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserId } from "@/lib/auth/session";
import { email } from "@/lib/email";
import { kv } from "@/lib/cache";
import { reportError } from "@/lib/observability/sentry";

/**
 * POST /api/feedback — 用户吐槽 / 反馈接收
 *
 * 流程：
 *   1. 内容校验：1-2000 字
 *   2. KV 限流：每 user 24h 内最多 5 条（避免 mailbomb）
 *   3. email.send 把内容发给 FEEDBACK_EMAIL_TO（FEEDBACK_EMAIL_TO 缺省 = console 打印）
 *   4. console.info 留底（即使 email send 成功，做日志方便回查）
 */
export const runtime = "nodejs";

const Body = z.object({
  category: z.enum(["建议", "缺陷", "内容偏离", "其他"]).default("其他"),
  content: z.string().min(1).max(2000),
  /** 可选联系方式（邮箱/微信号），便于回访 */
  contact: z.string().max(120).optional(),
});

const RATE_LIMIT_KEY = (uid: string) => `feedback:${uid}:24h`;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL = 24 * 3600;

export async function POST(req: Request): Promise<Response> {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await ensureUserId();
  const key = RATE_LIMIT_KEY(userId);

  // KV 限流：incr + 首次写入设 TTL
  let count = 0;
  try {
    count = await kv.incr(key, 1);
    if (count === 1) {
      await kv.expire(key, RATE_LIMIT_TTL);
    }
  } catch (e) {
    // KV 失败不阻塞，但记日志
    console.warn("[feedback] kv rate-limit failed", e);
  }
  if (count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: "24h" },
      { status: 429 },
    );
  }

  const to = process.env.FEEDBACK_EMAIL_TO ?? "feedback@qingyun-ai.example";
  const subject = `[福小运 反馈] ${parsed.data.category}`;
  const body = [
    `分类：${parsed.data.category}`,
    `用户：${userId}`,
    parsed.data.contact ? `联系：${parsed.data.contact}` : null,
    "----",
    parsed.data.content,
  ]
    .filter(Boolean)
    .join("\n");

  console.info(
    "[feedback]",
    JSON.stringify({ userId, category: parsed.data.category, len: parsed.data.content.length }),
  );

  try {
    const result = await email.send({
      to,
      subject,
      text: body,
      replyTo: parsed.data.contact && /\S+@\S+\.\S+/.test(parsed.data.contact)
        ? parsed.data.contact
        : undefined,
    });
    if (!result.ok) {
      console.warn("[feedback] email send failed", result.reason);
    }
  } catch (e) {
    reportError(e, { route: "/api/feedback", userId });
  }

  return NextResponse.json({ ok: true });
}
