import { describe, it, expect } from "vitest";
import { GUA64, TRIGRAMS, findGuaByName, findGuaByTrigrams } from "./gua64";

describe("GUA64 (M3.16 64 卦字典)", () => {
  it("64 条记录", () => {
    expect(GUA64.length).toBe(64);
  });

  it("每条都有 name / upper / lower / pan_ci / yao_ci(6 行) / tuan_ci", () => {
    for (const g of GUA64) {
      expect(g.name).toBeTruthy();
      expect(g.upper).toBeTruthy();
      expect(g.lower).toBeTruthy();
      expect(g.pan_ci).toBeTruthy();
      expect(g.tuan_ci).toBeTruthy();
      const yaos = JSON.parse(g.yao_ci);
      expect(Array.isArray(yaos)).toBe(true);
      expect(yaos.length).toBe(6);
      for (const y of yaos) {
        expect(typeof y).toBe("string");
        expect(y.length).toBeGreaterThan(0);
      }
    }
  });

  it("upper / lower 严格属于 8 trigram 集合", () => {
    const T = new Set(["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]);
    expect(TRIGRAMS).toHaveLength(8);
    for (const t of TRIGRAMS) {
      expect(T.has(t)).toBe(true);
    }
    for (const g of GUA64) {
      expect(T.has(g.upper)).toBe(true);
      expect(T.has(g.lower)).toBe(true);
    }
  });

  it("name 全部唯一", () => {
    const names = new Set(GUA64.map((g) => g.name));
    expect(names.size).toBe(64);
  });

  it("(upper, lower) 组合全部唯一（覆盖 8×8=64）", () => {
    const pairs = new Set(GUA64.map((g) => `${g.upper}-${g.lower}`));
    expect(pairs.size).toBe(64);
  });

  it("8 个本宫卦（上下相同）正确", () => {
    const expected = ["乾", "震", "坎", "艮", "坤", "巽", "离", "兑"] as const;
    for (const t of expected) {
      const g = findGuaByTrigrams(t, t);
      expect(g, `${t}为本宫卦应存在`).toBeDefined();
      expect(g!.name).toBe(t);
    }
  });

  it("findGuaByName 工作正常", () => {
    const qian = findGuaByName("乾");
    expect(qian?.upper).toBe("乾");
    expect(qian?.lower).toBe("乾");

    const taiyi = findGuaByName("泰");
    expect(taiyi?.upper).toBe("坤");
    expect(taiyi?.lower).toBe("乾");
  });

  it("findGuaByTrigrams 工作正常", () => {
    const fou = findGuaByTrigrams("乾", "坤");
    expect(fou?.name).toBe("否");

    const tai = findGuaByTrigrams("坤", "乾");
    expect(tai?.name).toBe("泰");
  });

  it("name 无繁体残留（traditional → simplified 归一）", () => {
    const traditionalChars = ["遯", "剝", "晉", "恆", "豐", "師", "漸", "渙"];
    const allNames = GUA64.map((g) => g.name).join("");
    for (const ch of traditionalChars) {
      expect(allNames).not.toContain(ch);
    }
    // 必含其简体对应
    expect(allNames).toContain("遁");
    expect(allNames).toContain("剥");
    expect(allNames).toContain("晋");
    expect(allNames).toContain("恒");
    expect(allNames).toContain("丰");
    expect(allNames).toContain("师");
    expect(allNames).toContain("渐");
    expect(allNames).toContain("涣");
  });
});
