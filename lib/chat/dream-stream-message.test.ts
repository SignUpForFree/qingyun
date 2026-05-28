import { describe, expect, it } from "vitest";
import {
  createDreamStreamingShell,
  isDreamStreamingShellId,
  patchDreamStreamingMessage,
} from "./dream-stream-message";

describe("dream-stream-message", () => {
  it("createDreamStreamingShell 带 dream-stream 前缀", () => {
    const shell = createDreamStreamingShell();
    expect(isDreamStreamingShellId(shell.id)).toBe(true);
    expect(shell.content).toBe("");
    expect(shell.metadata).toContain("dream_result_fast");
  });

  it("patchDreamStreamingMessage 更新正文", () => {
    const shell = createDreamStreamingShell();
    const next = patchDreamStreamingMessage([shell], shell.id, "**梦境核心解析**\n你好");
    expect(next[0]?.content).toContain("梦境核心解析");
  });
});
