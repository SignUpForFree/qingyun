import { describe, expect, it } from "vitest";
import { DAILY_DIMS, isDailyDim } from "./seven";
import { DIVINATION_DIMS, isDivinationDim } from "./six";

describe("dimensions/seven", () => {
  it("DAILY_DIMS has exactly 7 entries", () => {
    expect(DAILY_DIMS).toHaveLength(7);
  });

  it("DAILY_DIMS entries are unique", () => {
    expect(new Set(DAILY_DIMS).size).toBe(DAILY_DIMS.length);
  });

  it("isDailyDim narrows known strings", () => {
    expect(isDailyDim("爱情")).toBe(true);
    expect(isDailyDim("心情")).toBe(true);
    expect(isDailyDim("财运")).toBe(false);
    expect(isDailyDim("")).toBe(false);
  });
});

describe("dimensions/six", () => {
  it("DIVINATION_DIMS has exactly 6 entries", () => {
    expect(DIVINATION_DIMS).toHaveLength(6);
  });

  it("DIVINATION_DIMS entries are unique", () => {
    expect(new Set(DIVINATION_DIMS).size).toBe(DIVINATION_DIMS.length);
  });

  it("isDivinationDim narrows known strings", () => {
    expect(isDivinationDim("综合运势")).toBe(true);
    expect(isDivinationDim("平安健康")).toBe(true);
    expect(isDivinationDim("心情")).toBe(false);
    expect(isDivinationDim("")).toBe(false);
  });

  it("seven and six dimension sets do not overlap on coincidence keys", () => {
    const overlap = (DAILY_DIMS as readonly string[]).filter((d) =>
      (DIVINATION_DIMS as readonly string[]).includes(d),
    );
    expect(overlap).toEqual([]);
  });
});
