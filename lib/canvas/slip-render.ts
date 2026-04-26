import "server-only";
import path from "node:path";
import fs from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

export interface SlipRenderInput {
  slipNumber: number;
  level: string;
  title: string;
  poem: string;
}

// 注册马善政 CJK 毛笔字体（spec §6 V1.0：避免 Alpine 容器无中文字体回退到 .notdef）
// 字体文件 ~5.8MB，OFL 1.1，随仓库 public/fonts/ 一起 ship 进 standalone bundle
const FONT_FAMILY = "Ma Shan Zheng";
let fontRegistered = false;
function ensureFont(): void {
  if (fontRegistered) return;
  const fontPath = path.join(process.cwd(), "public/fonts/MaShanZheng-Regular.ttf");
  if (fs.existsSync(fontPath)) {
    try {
      GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
    } catch (e) {
      console.warn("[slip-render] 字体注册失败，回退 serif", e);
    }
  } else {
    console.warn(`[slip-render] 字体文件不存在 ${fontPath}，回退 serif`);
  }
  fontRegistered = true;
}

/**
 * 服务端 Canvas 合成签文图片（spec §6 / V1.0 文档 §抽签）
 *
 * - 750×1000 PNG
 * - 米色背景 + 紫墨字
 * - 第 N 签 · 等级 / 签题 / 签诗 wrap
 * - V1.0 不含背景图（公共 fonts/images 留作 V1.1 升级位）
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

  // 签号 + 等级
  ctx.font = `40px "${FONT_FAMILY}", serif`;
  ctx.fillText(`第 ${input.slipNumber} 签 · ${input.level}`, W / 2, 150);

  // 签题
  ctx.font = `60px "${FONT_FAMILY}", serif`;
  ctx.fillText(input.title, W / 2, 320);

  // 分割线
  ctx.beginPath();
  ctx.moveTo(W / 2 - 80, 380);
  ctx.lineTo(W / 2 + 80, 380);
  ctx.strokeStyle = "rgba(160, 130, 195, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 签诗
  ctx.font = `32px "${FONT_FAMILY}", serif`;
  ctx.fillStyle = "#3a2a4a";
  wrapText(ctx, input.poem, W / 2, 500, 600, 50);

  // 装饰：底部签号（保留 serif，No. 是 ASCII）
  ctx.font = '20px serif';
  ctx.fillStyle = "rgba(160, 130, 195, 0.6)";
  ctx.fillText(`No. ${input.slipNumber}`, W / 2, H - 80);

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
