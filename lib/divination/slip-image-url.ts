/** 签图版式版本：改 Canvas 排版后 +1，URL 带 layout= 破除浏览器旧图缓存 */
export const SLIP_LAYOUT_VERSION = 4;

/**
 * 抽签分享图 URL（带 category 时 Canvas 会渲染维度副文）
 * layout= 随版式递增，避免浏览器缓存旧 PNG
 */
export function buildSlipImageUrl(slipNumber: number, category?: string): string {
  const base = `/api/divination/slip-image/${slipNumber}`;
  const params = new URLSearchParams();
  params.set("layout", String(SLIP_LAYOUT_VERSION));
  if (category?.trim()) {
    params.set("category", category.trim());
  }
  return `${base}?${params.toString()}`;
}
