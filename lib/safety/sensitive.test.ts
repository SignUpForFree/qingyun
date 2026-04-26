import { describe, it, expect } from "vitest";
import { classifySafety } from "./sensitive";

describe("classifySafety", () => {
  it("普通文本 → ok", () => {
    expect(classifySafety("最近运气怎样")).toMatchObject({ level: "ok" });
  });

  it("空字符串 → ok（边界）", () => {
    expect(classifySafety("")).toMatchObject({ level: "ok" });
    expect(classifySafety("   ")).toMatchObject({ level: "ok" });
  });

  it("hard 命中 → level=hard + message", () => {
    const r = classifySafety("我想买点毒品");
    expect(r.level).toBe("hard");
    expect(r.matched).toContain("毒品");
    expect(r.message.length).toBeGreaterThan(0);
  });

  it("soft 命中 → level=soft + 援助热线", () => {
    const r = classifySafety("最近真的活不下去了");
    expect(r.level).toBe("soft");
    expect(r.matched).toContain("活不下去");
    expect(r.message).toContain("热线");
  });

  it("hard 优先于 soft", () => {
    const r = classifySafety("我想自杀，靠毒品解决");
    expect(r.level).toBe("hard");
  });

  it("多个 hard 全部记录", () => {
    const r = classifySafety("贩毒和炸弹哪个更刺激");
    expect(r.level).toBe("hard");
    expect(r.matched.length).toBeGreaterThanOrEqual(2);
  });

  it("多个 soft 全部记录", () => {
    const r = classifySafety("有时候想死，活不下去");
    expect(r.level).toBe("soft");
    expect(r.matched).toContain("想死");
    expect(r.matched).toContain("活不下去");
  });
});
