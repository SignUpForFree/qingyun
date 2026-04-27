import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { verifyOtp } from "@/lib/auth/phone-otp";
import { getDb } from "@/lib/db/client";
import { phoneBind } from "@/lib/db/schema";

/**
 * POST /api/me/phone/change — 校验 OTP 并 upsert phone_bind
 *
 * 流程：
 *   1. 必须登录态（qy_uid cookie 已有）
 *   2. body { phone, code } 通过 zod 校验
 *   3. verifyOtp 通过 → upsert phone_bind（PK 是 user_id）
 *      - 已绑过：UPDATE phone_e164 + last_changed_at
 *      - 未绑过：INSERT 新行（bound_at 由 schema $defaultFn 写当下时间）
 *   4. phone_e164 全局 unique，被别人绑过会触发 SQLITE_CONSTRAINT → 409 phone_already_bound
 *
 * 不做事务：单用户不会从两台设备并发改自己手机号（last_changed_at 竞态可忽略）。
 * spec §3.5 / plan §M1.10.
 */
export const runtime = "nodejs";

// E.164 strict: leading + REQUIRED. Without `+` the store key would diverge
// from the send-OTP key (`+8613...` vs `8613...`), making verify always fail
// closed with `expired` — silent UX trap.
const ChangeBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const parsed = ChangeBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { phone, code } = parsed.data;
    const result = await verifyOtp(phone, code);
    if (!result.ok) {
      return NextResponse.json(
        { error: "verify_failed", reason: result.reason },
        { status: 400 },
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    try {
      const [existing] = await db
        .select()
        .from(phoneBind)
        .where(eq(phoneBind.user_id, userId))
        .limit(1);
      if (existing) {
        await db
          .update(phoneBind)
          .set({ phone_e164: phone, last_changed_at: now })
          .where(eq(phoneBind.user_id, userId));
      } else {
        await db.insert(phoneBind).values({
          user_id: userId,
          phone_e164: phone,
          bound_at: now,
        });
      }
    } catch (e) {
      // phone_e164 全局 unique → 已被另一用户绑定
      if (e instanceof Error && /UNIQUE|constraint/i.test(e.message)) {
        return NextResponse.json(
          { error: "phone_already_bound" },
          { status: 409 },
        );
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    throw e;
  }
}
