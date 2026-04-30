import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import {
  updateProfile,
  deleteProfile,
  ProfileNotFoundError,
  CannotDeleteDefaultProfileError,
} from "@/lib/profile/repository";

/**
 * PUT    /api/me/profiles/[id] — 更新档案；带 is_default=true 时原子切默认档
 * DELETE /api/me/profiles/[id] — 删档案；默认档拒绝（先 PUT 别的档为默认才能删此档）
 *
 * spec §3.3 A3 / plan §M1.9
 *
 * is_default 仅接受 true（原子换默认）。是否可以「直接把当前默认档改成 false」？不行 —
 * 这会留下用户没有默认档的状态，业务上不允许。换默认必须显式 PUT 另一个档为 true。
 */
export const runtime = "nodejs";

const UpdateBody = z.object({
  nickname: z.string().min(1).max(40).optional(),
  avatar_url: z.string().url().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birth_date 必须是 YYYY-MM-DD")
    .optional(),
  birth_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "birth_time 必须是 HH:mm")
    .optional(),
  birth_calendar: z.enum(["solar", "lunar"]).optional(),
  birth_is_leap_month: z.boolean().optional(),
  birth_place: z.string().min(1).max(80).optional(),
  current_address: z.string().max(80).optional(),
  is_default: z.literal(true).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = UpdateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const updated = await updateProfile(userId, id, parsed.data);
    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    if (e instanceof ProfileNotFoundError) {
      return new NextResponse("not found", { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteProfile(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    if (e instanceof ProfileNotFoundError) {
      return new NextResponse("not found", { status: 404 });
    }
    if (e instanceof CannotDeleteDefaultProfileError) {
      return NextResponse.json(
        { error: "cannot_delete_default_profile", message: e.message },
        { status: 400 },
      );
    }
    throw e;
  }
}
