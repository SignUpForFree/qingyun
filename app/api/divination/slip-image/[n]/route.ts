import { NextResponse } from "next/server";
import { renderSlipToBuffer, type SlipCategory } from "@/lib/canvas/slip-render";
import { getSlip, DIVINATION_DIMS } from "@/lib/divination/slips";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * /api/divination/slip-image/[n]?category=综合运势 — 抽签图 PNG (M3.5)
 *
 * 路径参数 n: 1-100
 * Query category: 6 维度之一（可选）— 命中即在底部画印章 + 顶部副标 + 副文
 *
 * Response: image/png with public cache 24h
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ n: string }> },
): Promise<Response> {
  const { n } = await ctx.params;
  const slipNumber = Number.parseInt(n, 10);
  if (!Number.isFinite(slipNumber) || slipNumber < 1 || slipNumber > 100) {
    return NextResponse.json(
      { error: `slipNumber 必须是 1-100，收到 ${n}` },
      { status: 400 },
    );
  }

  let slip;
  try {
    slip = getSlip(slipNumber);
  } catch {
    return NextResponse.json({ error: `第 ${slipNumber} 签不存在` }, { status: 404 });
  }

  const url = new URL(_req.url);
  const rawCategory = url.searchParams.get("category");
  const category = rawCategory && isValidCategory(rawCategory) ? rawCategory : undefined;
  const dimensionReading = category ? slip.categoryReadings[category] : undefined;

  const png = await renderSlipToBuffer({
    slipNumber: slip.number,
    level: slip.level,
    title: slip.title,
    poem: slip.poem,
    category,
    dimensionReading,
  });

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
      "Content-Length": String(png.length),
    },
  });
}

function isValidCategory(s: string): s is SlipCategory {
  return (DIVINATION_DIMS as readonly string[]).includes(s);
}
