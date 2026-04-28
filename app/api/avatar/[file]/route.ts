import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * GET /api/avatar/[file] — public 头像静态 serve
 *
 * file 必须是 hash + 已知扩展名形态（防遍历），缓存 1 年（hash 命名内容不变）。
 * middleware 已放行 /api/avatar/。
 */
export const runtime = "nodejs";

const STORAGE_ROOT =
  process.env.AVATAR_STORAGE_ROOT ?? path.join(process.cwd(), "data", "uploads", "avatars");

const FILE_RE = /^[a-f0-9]{64}\.(jpg|png|webp)$/;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

interface Params {
  params: Promise<{ file: string }>;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { file } = await params;
  if (!FILE_RE.test(file)) {
    return new NextResponse("not found", { status: 404 });
  }
  const fullPath = path.join(STORAGE_ROOT, file);
  // 防 path traversal: 计算后必须仍在 STORAGE_ROOT 下
  const rel = path.relative(STORAGE_ROOT, fullPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return new NextResponse("not found", { status: 404 });
  }
  try {
    await stat(fullPath);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
  const buf = await readFile(fullPath);
  const ext = file.split(".").pop()!;
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
