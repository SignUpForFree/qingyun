import "server-only";
import path from "node:path";
import fs from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

export type SlipCategory =
  | "综合运势"
  | "事业学业"
  | "财运"
  | "感情姻缘"
  | "人际贵人"
  | "平安健康";

export interface SlipRenderInput {
  slipNumber: number;
  level: string;
  title: string;
  poem: string;
  /** M3.5: 6 类抽签维度，作为底部水印印章 + 顶部副标 */
  category?: SlipCategory | string;
  /** M3.5: 静态解签词（categoryReadings[category]），渲染在签诗下方 */
  dimensionReading?: string;
}

// 注册马善政 CJK 毛笔字体（spec §6 V1.0：避免 Alpine 容器无中文字体回退到 .notdef）
// 字体文件 ~5.8MB，OFL 1.1，随仓库 public/fonts/ 一起 ship 进 standalone bundle
const FONT_FAMILY = "Ma Shan Zheng";
const FONT_FALLBACK_STACK = `"${FONT_FAMILY}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Zen Hei", "Noto Sans CJK SC", serif`;
let fontRegistered = false;
let fontAvailable = false;
function ensureFont(): void {
  if (fontRegistered) return;
  const fontPath = path.join(process.cwd(), "public/fonts/MaShanZheng-Regular.ttf");
  if (fs.existsSync(fontPath)) {
    try {
      GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
      fontAvailable = true;
    } catch (e) {
      console.warn("[slip-render] 字体注册失败，回退 fallback stack", e);
      fontAvailable = false;
    }
  } else {
    console.warn(`[slip-render] 字体文件不存在 ${fontPath}，回退 fallback stack`);
    fontAvailable = false;
  }
  fontRegistered = true;
}

/**
 * 服务端 Canvas 合成签文图片（spec §6 / M3.5）
 *
 * - 750×1000 PNG
 * - 米色背景 + 紫墨字
 * - 第 N 签 · 等级 / 签题 / 签诗 wrap
 * - M3.5：可选 6 类维度水印（顶部副标 + 底部印章）+ category dimensionReading 副文
 * - 防御 M0.8：返回 PNG 必须 > 30KB（字形真的写进去了，不是只剩背景）
 *
 * 用 @napi-rs/canvas 而非 node canvas — 无 cairo / pango 系统依赖，
 * Docker Alpine 上直接 npm install 即可。
 */
export async function renderSlipToBuffer(input: SlipRenderInput): Promise<Buffer> {
  ensureFont();
  const W = 750;
  const H = 1000;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 米色背景
  ctx.fillStyle = "#F5EFE6";
  ctx.fillRect(0, 0, W, H);

  // 内描边（仙气框）
  ctx.strokeStyle = "rgba(160, 130, 195, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.fillStyle = "#3a2a4a";
  ctx.textAlign = "center";

  // 顶部 category 副标（可选）
  if (input.category) {
    ctx.font = `26px ${FONT_FALLBACK_STACK}`;
    ctx.fillStyle = "rgba(160, 130, 195, 0.85)";
    ctx.fillText(`· ${input.category} ·`, W / 2, 90);
  }

  // 签号 + 等级
  ctx.fillStyle = "#3a2a4a";
  ctx.font = `40px ${FONT_FALLBACK_STACK}`;
  ctx.fillText(`第 ${input.slipNumber} 签 · ${input.level}`, W / 2, 160);

  // 签题
  ctx.font = `60px ${FONT_FALLBACK_STACK}`;
  ctx.fillText(input.title, W / 2, 320);

  // 分割线
  ctx.beginPath();
  ctx.moveTo(W / 2 - 80, 380);
  ctx.lineTo(W / 2 + 80, 380);
  ctx.strokeStyle = "rgba(160, 130, 195, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 签诗
  ctx.font = `32px ${FONT_FALLBACK_STACK}`;
  ctx.fillStyle = "#3a2a4a";
  wrapText(ctx, input.poem, W / 2, 480, 600, 50);

  // dimensionReading 副文（M3.5：30 字内的当类静态解读）
  if (input.dimensionReading) {
    ctx.font = `22px ${FONT_FALLBACK_STACK}`;
    ctx.fillStyle = "rgba(80, 60, 100, 0.85)";
    wrapText(ctx, input.dimensionReading, W / 2, 740, 560, 34);
  }

  // M3.5 底部 category 印章（淡水印）
  if (input.category) {
    drawCategorySeal(ctx, W / 2, H - 130, input.category);
  }

  // 装饰：底部签号（保留 serif，No. 是 ASCII）
  ctx.font = "20px serif";
  ctx.fillStyle = "rgba(160, 130, 195, 0.6)";
  ctx.fillText(`No. ${input.slipNumber}`, W / 2, H - 70);

  return Buffer.from(canvas.toBuffer("image/png"));
}

interface CanvasCtx {
  measureText: (text: string) => { width: number };
  fillText: (text: string, x: number, y: number) => void;
}

function wrapText(
  ctx: CanvasCtx,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  lineH: number,
): void {
  const chars = [...text];
  let line = "";
  let yy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      ctx.fillText(line, cx, yy);
      line = ch;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

type CanvasContext = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

/**
 * 画 category 印章水印 — 红朱方框 + 双字短文（"事业 / 财运 / 健康"）
 *
 * 不取 category 全名（避免 4-5 字挤），按维度映射：
 *   综合运势 → 综运
 *   事业学业 → 事业
 *   财运    → 财运
 *   感情姻缘 → 感情
 *   人际贵人 → 人际
 *   平安健康 → 健康
 */
function drawCategorySeal(
  ctx: CanvasContext,
  cx: number,
  cy: number,
  category: string,
): void {
  const sealText = SEAL_TEXT[category] ?? category.slice(0, 2);
  const half = 32;

  ctx.save();
  ctx.strokeStyle = "rgba(180, 60, 60, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(cx - half, cy - half, half * 2, half * 2);
  ctx.stroke();

  ctx.font = `28px ${FONT_FALLBACK_STACK}`;
  ctx.fillStyle = "rgba(180, 60, 60, 0.7)";
  // 印章里 2 字纵排
  const ch0 = sealText[0] ?? "";
  const ch1 = sealText[1] ?? "";
  ctx.fillText(ch0, cx, cy - 4);
  ctx.fillText(ch1, cx, cy + 26);
  ctx.restore();
}

const SEAL_TEXT: Record<string, string> = {
  综合运势: "综运",
  事业学业: "事业",
  财运: "财运",
  感情姻缘: "感情",
  人际贵人: "人际",
  平安健康: "健康",
};

/** 给路由层做诊断用 — 检测当前进程是否已加载到 CJK 字体 */
export function isFontAvailable(): boolean {
  ensureFont();
  return fontAvailable;
}
