import "server-only";
import path from "node:path";
import fs from "node:fs";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";

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
  category?: SlipCategory | string;
  dimensionReading?: string;
}

const PALETTE = {
  paperTop: "#FFFBFE",
  paperMid: "#F6EEF9",
  paperBottom: "#EDE4F6",
  inkPlum: "#4A3D5C",
  inkMist: "#6B5A7A",
  inkFade: "#9A8DAB",
  lavender: "#C9A1D9",
  plum: "#8B5D8B",
  blush: "#F0B8C8",
} as const;

const FONT_FAMILY = "Ma Shan Zheng";
const FONT_FALLBACK_STACK = `"${FONT_FAMILY}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", serif`;
const SANS_STACK = `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;

import { SLIP_LAYOUT_VERSION } from "@/lib/divination/slip-image-url";

export { SLIP_LAYOUT_VERSION };

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

type CanvasContext = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

/**
 * 服务端 Canvas 合成签文分享图
 *
 * 版式（自上而下）：签号 → 签名（最大）→ 等级 → 类别 → 签诗 → 解读语
 * 右下：福小运 logo + 名称 + 扫码二维码
 */
export async function renderSlipToBuffer(input: SlipRenderInput): Promise<Buffer> {
  ensureFont();
  const W = 750;
  const H = 1000;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  drawPaperBackground(ctx, W, H);
  drawAmbientDots(ctx, W, H);
  drawOuterFrame(ctx, W, H);
  drawCornerBlossoms(ctx, W, H);

  const frameX = 48;
  const frameY = 64;
  const frameW = W - frameX * 2;
  const frameH = H - frameY - 56;
  const contentMaxW = frameW - 72;
  const cx = W / 2;

  drawInnerPanel(ctx, frameX, frameY, frameW, frameH);

  const brandReserve = 108;
  const contentBottom = frameY + frameH - brandReserve;
  ctx.textAlign = "center";

  let y = frameY + 44;

  // 1. 签序号（独立一行，不与签名共用 baseline）
  y += drawTextLine(
    ctx,
    cx,
    y,
    `第 ${input.slipNumber} 签`,
    `28px ${SANS_STACK}`,
    PALETTE.inkFade,
  ).height;
  y += 28;

  // 2. 签名（最大字号，单独占一行）
  y += drawTitle(ctx, cx, y, input.title, contentMaxW);
  y += 8;

  // 3. 签等级（紧贴签名下方，单行文本）
  y += drawTextLine(
    ctx,
    cx,
    y,
    `${input.level}签`,
    `32px ${FONT_FALLBACK_STACK}`,
    PALETTE.plum,
  ).height;
  y += 22;

  // 4. 求签类型：XXXXX（与等级留足间距）
  if (input.category) {
    y += drawTextLine(
      ctx,
      cx,
      y,
      `求签类型：${input.category}`,
      `24px ${SANS_STACK}`,
      PALETTE.inkMist,
    ).height;
    y += 14;
  }

  drawOrnamentalDivider(ctx, cx, y + 4);
  y += 32;

  // 5. 签诗 — 标题略大+装饰框；正文无白底框
  y += drawSectionHeader(ctx, cx, y, "签诗");
  y += drawBodyText(ctx, cx, y, input.poem, contentMaxW, {
    fontSize: 34,
    lineGap: 18,
    maxBottom: contentBottom,
  });
  y += 20;

  // 6. 解签语 — 同上
  const reading = input.dimensionReading?.trim();
  if (reading && y < contentBottom - 48) {
    y += drawSectionHeader(ctx, cx, y, "解签语");
    drawBodyText(ctx, cx, y, reading, contentMaxW, {
      fontSize: 32,
      lineGap: 18,
      maxBottom: contentBottom,
    });
  }

  await drawBrandCorner(ctx, frameX + frameW - 24, frameY + frameH - 24, resolveShareUrl());

  return Buffer.from(canvas.toBuffer("image/png"));
}

function resolveShareUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL?.trim() ||
    process.env.PUBLIC_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return `${raw.replace(/\/$/, "")}/chat`;
}

function parseFontSize(font: string): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m ? Number(m[1]) : 16;
}

interface LineMetrics {
  width: number;
  ascent: number;
  descent: number;
  height: number;
}

function measureLine(ctx: CanvasContext, text: string, font: string): LineMetrics {
  ctx.font = font;
  const m = ctx.measureText(text);
  const size = parseFontSize(font);
  const ascent = m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : size * 0.85;
  const descent = m.actualBoundingBoxDescent > 0 ? m.actualBoundingBoxDescent : size * 0.2;
  return { width: m.width, ascent, descent, height: ascent + descent };
}

/** 以 topY 为顶边绘制单行，返回真实占位高度（避免书法字体顶到上一行） */
function drawTextLine(
  ctx: CanvasContext,
  cx: number,
  topY: number,
  text: string,
  font: string,
  color: string,
): LineMetrics {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const met = measureLine(ctx, text, font);
  ctx.fillText(text, cx, topY + met.ascent);
  return met;
}

function drawTitle(ctx: CanvasContext, cx: number, topY: number, title: string, maxW: number): number {
  let fontSize = 80;
  let font = `${fontSize}px ${FONT_FALLBACK_STACK}`;
  while (fontSize >= 44) {
    font = `${fontSize}px ${FONT_FALLBACK_STACK}`;
    if (measureLine(ctx, title, font).width <= maxW) break;
    fontSize -= 4;
  }
  return drawTextLine(ctx, cx, topY, title, font, PALETTE.inkPlum).height;
}

/** 区块标题（签诗 / 解签语）：胶囊形边框，仅框标题不框正文 */
function drawSectionHeader(ctx: CanvasContext, cx: number, topY: number, label: string): number {
  const fontSize = 30;
  const font = `bold ${fontSize}px ${SANS_STACK}`;
  const tw = measureLine(ctx, label, font).width;
  const padX = 28;
  const padY = 10;
  const bw = tw + padX * 2;
  const bh = fontSize + padY * 2;
  const bx = cx - bw / 2;
  const pillR = bh / 2;

  roundRect(ctx, bx, topY, bw, bh, pillR);
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.fill();
  ctx.strokeStyle = "rgba(201, 161, 217, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const lineMet = measureLine(ctx, label, font);
  const textTop = topY + Math.max(4, (bh - lineMet.height) / 2);
  drawTextLine(ctx, cx, textTop, label, font, PALETTE.plum);
  return bh + 16;
}

/** 正文：直接落在纸面上，无白底框 */
function drawBodyText(
  ctx: CanvasContext,
  cx: number,
  topY: number,
  body: string,
  maxW: number,
  opts: { fontSize: number; lineGap: number; maxBottom: number },
): number {
  const font = `${opts.fontSize}px ${FONT_FALLBACK_STACK}`;
  const lines = measureWrappedLines(ctx, body, maxW - 32);
  let yy = topY + 6;
  let used = 0;
  for (const line of lines) {
    const met = drawTextLine(ctx, cx, yy, line, font, PALETTE.inkMist);
    if (yy + met.height > opts.maxBottom) break;
    yy += met.height + opts.lineGap;
    used = yy - topY;
  }
  return Math.max(used, opts.fontSize + opts.lineGap);
}

async function drawBrandCorner(
  ctx: CanvasContext,
  anchorRight: number,
  anchorBottom: number,
  shareUrl: string,
): Promise<void> {
  const qrSize = 80;
  const gap = 14;

  const qrX = anchorRight - qrSize;
  const qrY = anchorBottom - qrSize;

  try {
    const qrBuffer = await QRCode.toBuffer(shareUrl, {
      margin: 1,
      width: qrSize,
      color: { dark: PALETTE.inkPlum, light: "#FFFFFF" },
    });
    const qrImg = await loadImage(qrBuffer);
    roundRect(ctx, qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 8);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch (e) {
    console.warn("[slip-render] QR 生成失败", e);
  }

  const textRight = qrX - gap;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PALETTE.plum;
  ctx.font = `28px ${FONT_FALLBACK_STACK}`;
  ctx.fillText("福小运", textRight, anchorBottom - 28);
  ctx.fillStyle = PALETTE.inkFade;
  ctx.font = `18px ${SANS_STACK}`;
  ctx.fillText("灵签 · 扫码", textRight, anchorBottom - 6);
  ctx.textAlign = "center";
}

function drawPaperBackground(ctx: CanvasContext, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.paperTop);
  g.addColorStop(0.45, PALETTE.paperMid);
  g.addColorStop(1, PALETTE.paperBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const rg = ctx.createRadialGradient(w * 0.5, h * 0.2, 40, w * 0.5, h * 0.28, w * 0.85);
  rg.addColorStop(0, "rgba(240, 184, 200, 0.2)");
  rg.addColorStop(1, "rgba(255, 251, 254, 0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function drawAmbientDots(ctx: CanvasContext, w: number, h: number): void {
  const seeds = [12, 37, 58, 91, 124, 156, 203, 241, 288, 317, 402, 455, 501, 533];
  ctx.fillStyle = "rgba(201, 161, 217, 0.3)";
  for (const seed of seeds) {
    const x = 40 + ((seed * 17) % (w - 80));
    const y = 50 + ((seed * 23) % (h - 140));
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + (seed % 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOuterFrame(ctx: CanvasContext, w: number, h: number): void {
  roundRect(ctx, 24, 24, w - 48, h - 48, 28);
  ctx.strokeStyle = "rgba(201, 161, 217, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawInnerPanel(ctx: CanvasContext, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(201, 161, 217, 0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCornerBlossoms(ctx: CanvasContext, w: number, h: number): void {
  const corners: [number, number, number][] = [
    [56, 56, -0.35],
    [w - 56, 56, 0.35],
    [56, h - 56, 0.3],
    [w - 56, h - 56, -0.3],
  ];
  for (const [cx, cy, rot] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    drawPlumPetalCluster(ctx);
    ctx.restore();
  }
}

function drawPlumPetalCluster(ctx: CanvasContext): void {
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);
    ctx.fillStyle = i % 2 === 0 ? "rgba(240, 184, 200, 0.45)" : "rgba(201, 161, 217, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, -12, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawOrnamentalDivider(ctx: CanvasContext, cx: number, y: number): void {
  const half = 88;
  ctx.strokeStyle = "rgba(201, 161, 217, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - 14, y);
  ctx.moveTo(cx + 14, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.fillStyle = PALETTE.lavender;
  ctx.beginPath();
  ctx.arc(cx, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(
  ctx: CanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

interface CanvasCtx {
  measureText: (text: string) => { width: number };
  fillText: (text: string, x: number, y: number) => void;
  font: string;
}

function measureWrappedLines(ctx: CanvasCtx, text: string, maxW: number): string[] {
  const normalized = text.replace(/\n+/g, "\n").trim();
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const chars = [...para];
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

export function isFontAvailable(): boolean {
  ensureFont();
  return fontAvailable;
}
