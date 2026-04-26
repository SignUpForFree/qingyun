import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderSlipToBuffer } from "./slip-render";

describe("renderSlipToBuffer", () => {
  it("生成 PNG buffer", async () => {
    const buf = await renderSlipToBuffer({
      slipNumber: 1,
      level: "上上",
      title: "心定福自来",
      poem: "心闲气定福无涯，万事从容自到家。",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(2000);
    // PNG 魔数
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it("100 签号也能渲染", async () => {
    const buf = await renderSlipToBuffer({
      slipNumber: 100,
      level: "慎行",
      title: "静心养气",
      poem: "动则生扰静则安，急来缓后自宽宽。",
    });
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("长签诗能 wrap 不溢出（不抛错）", async () => {
    const long = "心闲气定福无涯，万事从容自到家。安然处世无烦扰，岁岁年年笑相迎。";
    const buf = await renderSlipToBuffer({
      slipNumber: 1,
      level: "上上",
      title: "长诗试",
      poem: long,
    });
    expect(buf.length).toBeGreaterThan(2000);
  });
});
