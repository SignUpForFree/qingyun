import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { divinationSlips } from "@/lib/db/schema";
import { renderSlipToBuffer } from "@/lib/canvas/slip-render";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * GET /api/divination/slip-image/[n] — 服务端 Canvas 合成签文图
 *
 * - n 范围 1-100（divination_slips 表）
 * - 第一次访问：渲染 PNG → 写文件缓存 → 返回 PNG
 * - 第二次访问：直接读缓存（X-Cache: HIT）
 * - public, max-age=86400（24 小时浏览器 + CDN 缓存）
 */
export const runtime = "nodejs";

const CACHE_DIR = path.join(process.cwd(), "data", "slip-cache");

export async function GET(
  _: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  const { n } = await params;
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > 100) {
    return new Response("invalid slip number", { status: 400 });
  }

  const cachePath = path.join(CACHE_DIR, `${num}.png`);

  // 命中缓存
  try {
    const buf = await fs.readFile(cachePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Cache": "HIT",
      },
    });
  } catch {
    /* 未命中 → 现渲染 */
  }

  const db = getDb();
  const [slip] = await db
    .select()
    .from(divinationSlips)
    .where(eq(divinationSlips.number, num))
    .limit(1);
  if (!slip) return new Response("not found", { status: 404 });

  const buf = await renderSlipToBuffer({
    slipNumber: slip.number,
    level: slip.level,
    title: slip.title,
    poem: slip.poem,
  });

  // 异步写缓存（不阻塞响应）
  void fs
    .mkdir(CACHE_DIR, { recursive: true })
    .then(() => fs.writeFile(cachePath, buf))
    .catch((e) => console.error("slip-image 缓存写入失败", e));

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-Cache": "MISS",
    },
  });
}
