import { describe, expect, it } from "vitest";
import { frame, heartbeat, SSE_HEADERS, safeEnqueue } from "./sse";

const decoder = new TextDecoder();

describe("frame() — SSE 6 事件帧", () => {
  it("meta 帧编码正确", () => {
    const buf = frame("meta", { conversationId: "c-1", intent: "chat", source: "keyword" });
    const text = decoder.decode(buf);
    expect(text).toBe(
      `event: meta\ndata: ${JSON.stringify({
        conversationId: "c-1",
        intent: "chat",
        source: "keyword",
      })}\n\n`,
    );
  });

  it("token 帧支持纯字符串 data", () => {
    const buf = frame("token", "你好");
    const text = decoder.decode(buf);
    expect(text).toBe('event: token\ndata: "你好"\n\n');
  });

  it("done 帧空对象", () => {
    expect(decoder.decode(frame("done", {}))).toBe("event: done\ndata: {}\n\n");
  });

  it("error 帧含 retryable 字段", () => {
    const buf = frame("error", { message: "AI 卡了", retryable: true });
    expect(decoder.decode(buf)).toContain('"retryable":true');
  });

  it("progress 帧含 stage / percent", () => {
    const buf = frame("progress", { stage: "computing", percent: 42 });
    expect(decoder.decode(buf)).toContain("computing");
    expect(decoder.decode(buf)).toContain("42");
  });
});

describe("heartbeat()", () => {
  it("注释帧 ': ping\\n\\n' — 浏览器忽略但阻止代理切连", () => {
    expect(decoder.decode(heartbeat())).toBe(": ping\n\n");
  });
});

describe("SSE_HEADERS", () => {
  it("含 text/event-stream + no-cache + X-Accel-Buffering: no", () => {
    expect(SSE_HEADERS["Content-Type"]).toContain("text/event-stream");
    expect(SSE_HEADERS["Cache-Control"]).toContain("no-cache");
    expect(SSE_HEADERS["X-Accel-Buffering"]).toBe("no");
  });
});

describe("safeEnqueue()", () => {
  it("正常 controller → 返回 true", () => {
    let queued: Uint8Array | null = null;
    const fakeController = {
      enqueue(chunk: Uint8Array) {
        queued = chunk;
      },
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    expect(safeEnqueue(fakeController, frame("done", {}))).toBe(true);
    expect(queued).not.toBeNull();
  });

  it("controller 已 close（throws）→ 返回 false 不传播", () => {
    const fakeController = {
      enqueue() {
        throw new TypeError("Controller is already closed");
      },
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    expect(safeEnqueue(fakeController, frame("done", {}))).toBe(false);
  });
});
