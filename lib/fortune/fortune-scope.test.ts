import { describe, it, expect } from "vitest";
import { parseFortuneScope } from "./fortune-scope";

describe("parseFortuneScope", () => {
  it("defaults to day", () => {
    expect(parseFortuneScope(undefined)).toBe("day");
    expect(parseFortuneScope("")).toBe("day");
    expect(parseFortuneScope("nope")).toBe("day");
  });

  it("accepts week and month", () => {
    expect(parseFortuneScope("week")).toBe("week");
    expect(parseFortuneScope("month")).toBe("month");
  });
});
