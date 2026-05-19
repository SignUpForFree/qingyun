import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { listProfiles, createProfile } from "@/lib/profile/repository";

/**
 * GET /api/me/profiles  — 列出当前用户所有档案（默认档优先，按 created_at 升序）
 * POST /api/me/profiles — 新建档案（is_default 始终 false；改默认走 PUT [id]）
 *
 * spec §3.3 A3 多档案模型 / plan §M1.9
 *
 * runtime=nodejs：依赖 better-sqlite3。
 */
export const runtime = "nodejs";

const CreateBody = z.object({
  nickname: z.string().min(1).max(40),
  avatar_url: z.string().url().optional(),
  gender: z.enum(["male", "female", "other"]),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "birth_date 必须是 YYYY-MM-DD"),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/, "birth_time 必须是 HH:mm"),
  birth_calendar: z.enum(["solar", "lunar"]).optional(),
  birth_is_leap_month: z.boolean().optional(),
  birth_place: z.string().min(1).max(80),
  current_address: z.string().max(80).optional(),
});

export async function GET(): Promise<Response> {
  try {
    const userId = await requireUserId();
    const data = await listProfiles(userId);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    throw e;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const created = await createProfile(userId, parsed.data);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    console.error("[POST /api/me/profiles] unhandled:", e);
    throw e;
  }
}
