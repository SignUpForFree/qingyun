import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { preview, previewFromContent, previewFromSummary, loadPreview } from "./preview";

describe("preview helpers (M2.26)", () => {
  it("previewFromSummary 截 30 字", () => {
    expect(previewFromSummary("这是一段非常短的摘要")).toBe("这是一段非常短的摘要");
    expect(previewFromSummary("0123456789".repeat(5))).toHaveLength(30);
  });

  it("previewFromSummary 空 / null → ''", () => {
    expect(previewFromSummary(null)).toBe("");
    expect(previewFromSummary("")).toBe("");
    expect(previewFromSummary("   ")).toBe("");
  });

  it("previewFromContent 同上", () => {
    expect(previewFromContent("我想问问感情")).toBe("我想问问感情");
    expect(previewFromContent(null)).toBe("");
  });

  it("preview summary 优先于 content", () => {
    expect(
      preview({ summary: "用户在问感情", firstUserContent: "其实是事业的问题" }),
    ).toBe("用户在问感情");
  });

  it("preview 无 summary fallback content", () => {
    expect(preview({ summary: null, firstUserContent: "我要抽签问感情" })).toBe(
      "我要抽签问感情",
    );
  });

  it("preview 都空 → ''", () => {
    expect(preview({ summary: null, firstUserContent: null })).toBe("");
    expect(preview({})).toBe("");
  });

  it("preview summary 是 trim 后空字符串 → fallback content", () => {
    expect(preview({ summary: "   ", firstUserContent: "fallback 文" })).toBe(
      "fallback 文",
    );
  });
});

describe("loadPreview (异步从 DB 拉)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("summary 存在 → 直接返回 summary 不查 DB", async () => {
    const { getDb } = await import("@/lib/db/client");
    const dbMock = vi.fn();
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(dbMock);
    const r = await loadPreview("c-1", "已有摘要");
    expect(r).toBe("已有摘要");
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("summary 空 → 查首条消息", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ content: "首条消息内容" }]),
            }),
          }),
        }),
      }),
    });
    const r = await loadPreview("c-1", null);
    expect(r).toBe("首条消息内容");
  });

  it("summary 空 + 无消息 → ''", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    });
    const r = await loadPreview("c-1", null);
    expect(r).toBe("");
  });
});
