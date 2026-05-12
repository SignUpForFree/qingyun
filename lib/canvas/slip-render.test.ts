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

  // ========== M3.5: 6 类 watermark + 字体 fallback + 30KB 防御 ==========

  it("有 CJK 字体注册时 PNG > 30KB（防御 M0.8 字形丢失静默失败）", async () => {
    const buf = await renderSlipToBuffer({
      slipNumber: 1,
      level: "上上",
      title: "心定福自来",
      poem: "心定福自来，莫问前程事。云开见月明，稳步自坦然。",
    });
    expect(buf.length).toBeGreaterThan(30_000);
  });

  it("6 类 dimension 各自不报错且 PNG > 30KB", async () => {
    const dims = [
      "综合运势",
      "事业学业",
      "财运",
      "感情姻缘",
      "人际贵人",
      "平安健康",
    ] as const;
    for (const dim of dims) {
      const buf = await renderSlipToBuffer({
        slipNumber: 1,
        level: "吉",
        title: "心定福自来",
        poem: "心定福自来，莫问前程事。云开见月明，稳步自坦然。",
        category: dim,
      });
      expect(buf.length).toBeGreaterThan(30_000);
    }
  }, 30_000);

  it("category 不同 → buffer 不同（watermark 真的生效）", async () => {
    const base = {
      slipNumber: 1,
      level: "上上" as const,
      title: "心定福自来",
      poem: "心定福自来。",
    };
    const a = await renderSlipToBuffer({ ...base, category: "事业学业" });
    const b = await renderSlipToBuffer({ ...base, category: "财运" });
    expect(a.equals(b)).toBe(false);
  });

  it("dimensionReading 注入会改变图（副文落地）", async () => {
    const base = {
      slipNumber: 1,
      level: "上上" as const,
      title: "心定福自来",
      poem: "心定福自来。",
      category: "财运",
    };
    const a = await renderSlipToBuffer(base);
    const b = await renderSlipToBuffer({
      ...base,
      dimensionReading: "稳中有变，宜守不宜进。",
    });
    expect(a.equals(b)).toBe(false);
  });
});
