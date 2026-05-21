import { describe, expect, it } from "vitest";
import { buildSlipImageUrl, SLIP_LAYOUT_VERSION } from "./slip-image-url";

describe("buildSlipImageUrl", () => {
  it("始终带 layout 参数以绕过旧 PNG 缓存", () => {
    expect(buildSlipImageUrl(92)).toMatch(
      new RegExp(`^/api/divination/slip-image/92\\?layout=${SLIP_LAYOUT_VERSION}`),
    );
  });

  it("category 与 layout 同时存在", () => {
    expect(buildSlipImageUrl(92, "综合运势")).toContain("layout=");
    expect(buildSlipImageUrl(92, "综合运势")).toContain(
      "category=%E7%BB%BC%E5%90%88%E8%BF%90%E5%8A%BF",
    );
  });
});
