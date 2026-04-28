import { describe, it, expect } from "vitest";
import { isWechatUA } from "./ua";

describe("isWechatUA", () => {
  it("微信内置浏览器（含 MicroMessenger）→ true", () => {
    const wxUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40(0x18002831) NetType/WIFI Language/zh_CN";
    expect(isWechatUA(wxUA)).toBe(true);
  });

  it("普通 mobile Chrome → false", () => {
    const chrome =
      "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/118.0 Mobile Safari/537.36";
    expect(isWechatUA(chrome)).toBe(false);
  });

  it("desktop Chrome → false", () => {
    expect(
      isWechatUA(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/118.0",
      ),
    ).toBe(false);
  });

  it("null / undefined / 空串 → false", () => {
    expect(isWechatUA(null)).toBe(false);
    expect(isWechatUA(undefined)).toBe(false);
    expect(isWechatUA("")).toBe(false);
  });

  it("大小写不敏感（micromessenger）", () => {
    expect(isWechatUA("Some UA with micromessenger token")).toBe(true);
  });
});
