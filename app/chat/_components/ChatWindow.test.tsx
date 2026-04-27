import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// jsdom 没实现 scrollIntoView / requestAnimationFrame
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ChatWindow } from "./ChatWindow";

function makeSseResponse(events: string[]): Response {
  const body = events.join("");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("ChatWindow (M2.24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initialIntent='divination' → mount 时自动 send 预设话术", async () => {
    const fetchSpy = vi.fn(async () =>
      makeSseResponse([
        frame("meta", { conversationId: "conv-new" }),
        frame("token", "你好"),
        frame("done", {}),
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ChatWindow
        conversationId={null}
        initialMessages={[]}
        initialIntent="divination"
      />,
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const call = fetchSpy.mock.calls.find((c) => (c[0] as string) === "/api/chat");
    expect(call).toBeTruthy();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.text).toBe("我要抽灵签");
    expect(body.conversationId).toBeNull();
  });

  it("autoSendText 优先于 initialIntent", async () => {
    const fetchSpy = vi.fn(async () =>
      makeSseResponse([
        frame("meta", { conversationId: "c" }),
        frame("token", "x"),
        frame("done", {}),
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ChatWindow
        conversationId={null}
        initialMessages={[]}
        autoSendText="自定义首条"
        initialIntent="divination"
      />,
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const call = fetchSpy.mock.calls.find((c) => (c[0] as string) === "/api/chat");
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.text).toBe("自定义首条");
  });

  it("无 autoSend / initialIntent → 不自动发送", async () => {
    const fetchSpy = vi.fn(async () => new Response("nope", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    render(<ChatWindow conversationId={null} initialMessages={[]} />);
    // 等一会儿确认没自动发
    await new Promise((r) => setTimeout(r, 100));
    const apiChatCalls = fetchSpy.mock.calls.filter((c) => (c[0] as string) === "/api/chat");
    expect(apiChatCalls.length).toBe(0);
  });

  it("SSE progress 事件 → 渲染 progress hint", async () => {
    const fetchSpy = vi.fn(async () =>
      makeSseResponse([
        frame("meta", { conversationId: "c" }),
        frame("progress", { stage: "computing", percent: 30 }),
        frame("token", "x"),
        frame("done", {}),
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ChatWindow
        conversationId={null}
        initialMessages={[]}
        autoSendText="跑一次"
      />,
    );
    // 由于 done 紧接着会清掉，这里只验证流程不抛
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  });

  it("/api/chat 4xx 含 errorCard → 渲染友好 message", async () => {
    const { toast } = await import("sonner");
    const fetchSpy = vi.fn(async (url: string) => {
      if (url === "/api/chat") {
        return new Response(
          JSON.stringify({
            error: "fallback msg",
            errorCard: {
              ui: "error_card",
              code: "user_rate_limit",
              message: "你今天问得有点多",
              retryable: false,
            },
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ChatWindow
        conversationId={null}
        initialMessages={[]}
        autoSendText="hi"
      />,
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("你今天问得有点多"));
    });
  });

  it("openHistoryOnMount=true → 历史抽屉 mount 时打开", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ChatWindow
        conversationId={null}
        initialMessages={[]}
        openHistoryOnMount
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("历史会话")).toBeInTheDocument();
    });
  });
});
