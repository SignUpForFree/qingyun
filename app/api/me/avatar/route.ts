import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

/**
 * POST /api/me/avatar — 上传当前用户的头像
 *
 * 接受 multipart/form-data，字段：
 *   file: image/jpeg|png|webp，<= 256 KB
 *   profile_id: 可选，目标档案 id（默认默认档）
 *
 * 客户端建议先 canvas resize 到 256×256 cover + jpeg q=0.85，<30KB。
 * 服务端只校验：mime / size / 写盘 + DB profile.avatar_url 更新。
 *
 * 返回 { url, profile_id }。url 形如 "/api/avatar/<hash>.jpg"，公开可访问
 * （middleware 已放行 /api/avatar/）。
 *
 * 文件存到 data/uploads/avatars/<sha256>.<ext>，hash 命名 = 内容去重 + 防遍历。
 */
export const runtime = "nodejs";

const MAX_BYTES = 256 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

const STORAGE_ROOT =
  process.env.AVATAR_STORAGE_ROOT ?? path.join(process.cwd(), "data", "uploads", "avatars");

export async function POST(req: Request): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    throw e;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const file = form.get("file");
  const profileIdRaw = form.get("profile_id");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", limit: MAX_BYTES },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  const ext = extFromMime(file.type);
  const filename = `${hash}.${ext}`;
  const fullPath = path.join(STORAGE_ROOT, filename);
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(fullPath, buf);

  const url = `/api/avatar/${filename}`;

  const db = getDb();
  const list = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId));
  const targetId =
    typeof profileIdRaw === "string" && profileIdRaw.length > 0
      ? profileIdRaw
      : (list.find((p) => p.is_default)?.id ?? list[0]?.id);
  if (!targetId) {
    return NextResponse.json({ error: "no_profile" }, { status: 400 });
  }
  // 校验越权：profile 必须属于当前 user
  const target = list.find((p) => p.id === targetId);
  if (!target) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  await db
    .update(profiles)
    .set({ avatar_url: url, updated_at: new Date().toISOString() })
    .where(eq(profiles.id, targetId));

  return NextResponse.json({ url, profile_id: targetId });
}
