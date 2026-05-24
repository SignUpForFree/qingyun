/**
 * 梅花报数解析：任意正整数 × 3
 *
 * - 含标点（逗号、顿号、空格等）→ 按分隔符拆成 3 段
 * - 无分隔 → 纯数字串按位数均分 3 份（如 294590 → 29、45、90）
 */

const SEPARATOR_RE = /[,，、;；\s.．·/\\|：:]+/;

export type ParseMeihuaNumbersResult =
  | { ok: true; numbers: [number, number, number] }
  | { ok: false; message: string };

function parsePositiveInt(segment: string): number | null {
  const digits = segment.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** 将连续数字均分为 3 段（余数从前向后分配） */
export function splitDigitsIntoThree(digits: string): [number, number, number] {
  const len = digits.length;
  const base = Math.floor(len / 3);
  const rem = len % 3;
  const sizes = [
    base + (rem > 0 ? 1 : 0),
    base + (rem > 1 ? 1 : 0),
    base,
  ];
  let offset = 0;
  const parts: string[] = [];
  for (const size of sizes) {
    parts.push(digits.slice(offset, offset + size));
    offset += size;
  }
  return parts.map((p) => Number.parseInt(p, 10)) as [number, number, number];
}

const ORDINAL_LABELS = ["一", "二", "三"] as const;

/** 三个独立输入框报数（各 1-99） */
export function parseMeihuaNumberFields(
  raw1: string,
  raw2: string,
  raw3: string,
): ParseMeihuaNumbersResult {
  const segments = [raw1, raw2, raw3];
  const numbers: number[] = [];

  for (let i = 0; i < 3; i++) {
    const trimmed = segments[i]?.trim() ?? "";
    if (!trimmed) {
      return { ok: false, message: `请输入第${ORDINAL_LABELS[i]}个数字` };
    }
    const n = parsePositiveInt(trimmed);
    if (n === null || n > 99) {
      return {
        ok: false,
        message: `第${ORDINAL_LABELS[i]}个数字须为 1-99 之间的整数`,
      };
    }
    numbers.push(n);
  }

  return { ok: true, numbers: numbers as [number, number, number] };
}

export function parseMeihuaNumbers(raw: string): ParseMeihuaNumbersResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "请输入 3 个数字" };
  }

  if (SEPARATOR_RE.test(trimmed)) {
    const parts = trimmed
      .split(SEPARATOR_RE)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length !== 3) {
      return {
        ok: false,
        message: "请用标点分隔 3 个数字，例如 29,45,90",
      };
    }
    const nums = parts.map(parsePositiveInt);
    if (nums.some((n) => n === null)) {
      return { ok: false, message: "分隔后的每一段都需为有效数字" };
    }
    return {
      ok: true,
      numbers: nums as [number, number, number],
    };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 3) {
    return {
      ok: false,
      message: "无分隔时请至少输入 3 位连续数字，例如 294590",
    };
  }
  const numbers = splitDigitsIntoThree(digits);
  if (numbers.some((n) => !Number.isFinite(n) || n < 1)) {
    return { ok: false, message: "数字格式无效，请重新输入" };
  }
  return { ok: true, numbers };
}
