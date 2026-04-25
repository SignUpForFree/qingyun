import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("合并 Tailwind 类名（后者覆盖前者）", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("过滤 falsy 值", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("条件类名", () => {
    const active = true;
    expect(cn("base", active && "active")).toBe("base active");
  });
});
