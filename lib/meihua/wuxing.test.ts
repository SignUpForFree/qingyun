import { describe, it, expect } from "vitest";
import { relate } from "./wuxing";

describe("relate", () => {
  it("比和：相同五行", () => {
    expect(relate("木", "木")).toBe("he");
    expect(relate("水", "水")).toBe("he");
  });

  it("生：相生顺序 木→火→土→金→水→木", () => {
    expect(relate("木", "火")).toBe("sheng");
    expect(relate("火", "土")).toBe("sheng");
    expect(relate("土", "金")).toBe("sheng");
    expect(relate("金", "水")).toBe("sheng");
    expect(relate("水", "木")).toBe("sheng");
  });

  it("克：相克顺序 木→土→水→火→金→木", () => {
    expect(relate("木", "土")).toBe("ke");
    expect(relate("土", "水")).toBe("ke");
    expect(relate("水", "火")).toBe("ke");
    expect(relate("火", "金")).toBe("ke");
    expect(relate("金", "木")).toBe("ke");
  });

  it("被生：是生关系的镜像", () => {
    expect(relate("火", "木")).toBe("sheng_by");
    expect(relate("木", "水")).toBe("sheng_by");
  });

  it("被克：是克关系的镜像", () => {
    expect(relate("土", "木")).toBe("ke_by");
    expect(relate("水", "土")).toBe("ke_by");
  });
});
