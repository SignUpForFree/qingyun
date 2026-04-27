import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { HistoryDrawerBody } from "./HistoryDrawer";

async function typeIn(input: HTMLElement, text: string): Promise<void> {
  fireEvent.change(input, { target: { value: text } });
}

const LIST_RESPONSE = {
  items: [
    {
      id: "c-today",
      title: "今日话题",
      preview: "刚问了感情",
      lastIntent: "chat",
      lastMessageAt: "2026-04-27T11:00:00Z",
      group: "today",
    },
    {
      id: "c-yest",
      title: "昨日话题",
      preview: "测了八字",
      lastIntent: "bazi",
      lastMessageAt: "2026-04-26T11:00:00Z",
      group: "yesterday",
    },
    {
      id: "c-old",
      title: "上周",
      preview: "求灵签",
      lastIntent: "divination",
      lastMessageAt: "2026-04-21T11:00:00Z",
      group: "7days",
    },
  ],
};

const SEARCH_RESPONSE = {
  items: [
    {
      id: "c-today",
      title: "今日话题",
      lastMessageAt: "2026-04-27T11:00:00Z",
      snippet: "...聊到<b>感情</b>...",
    },
  ],
};

function makeFetch(opts: { searchHits?: typeof SEARCH_RESPONSE.items } = {}) {
  return vi.fn(async (url: string) => {
    if (url.startsWith("/api/chat/conversations/search")) {
      return new Response(
        JSON.stringify({ items: opts.searchHits ?? SEARCH_RESPONSE.items }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.startsWith("/api/chat/conversations")) {
      return new Response(JSON.stringify(LIST_RESPONSE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("HistoryDrawerBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open=true 拉列表 + 渲染分组", async () => {
    const fetchImpl = makeFetch();
    render(
      <HistoryDrawerBody
        open
        onPickConversation={() => {}}
        fetchImpl={fetchImpl}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("今天")).toBeInTheDocument();
    });
    expect(screen.getByText("今日话题")).toBeInTheDocument();
    expect(screen.getByText("昨天")).toBeInTheDocument();
    expect(screen.getByText("昨日话题")).toBeInTheDocument();
    expect(screen.getByText("7 天内")).toBeInTheDocument();
    expect(screen.getByText("上周")).toBeInTheDocument();
  });

  it("preview 在卡片下展示", async () => {
    render(
      <HistoryDrawerBody
        open
        onPickConversation={() => {}}
        fetchImpl={makeFetch()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("刚问了感情")).toBeInTheDocument();
    });
  });

  it("搜索框输入 3+ 字 → 调 search 接口 → 渲染结果", async () => {
    const fetchImpl = makeFetch();
    render(
      <HistoryDrawerBody open onPickConversation={() => {}} fetchImpl={fetchImpl} />,
    );
    await waitFor(() => {
      expect(screen.getByText("今日话题")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/搜索/);
    await typeIn(input, "感情话");

    await waitFor(
      () => {
        const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
          (c) => c[0] as string,
        );
        expect(calls.some((u) => u.includes("/search?q="))).toBe(true);
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      expect(screen.getByText(/搜索结果/)).toBeInTheDocument();
    });
  });

  it("搜索 < 3 字不触发搜索", async () => {
    const fetchImpl = makeFetch();
    render(
      <HistoryDrawerBody open onPickConversation={() => {}} fetchImpl={fetchImpl} />,
    );
    await waitFor(() => {
      expect(screen.getByText("今日话题")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/搜索/);
    await typeIn(input, "感");
    await new Promise((r) => setTimeout(r, 500));

    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(calls.some((u) => u.includes("/search?q="))).toBe(false);
  });

  it("搜索清空 → 回到列表态", async () => {
    render(
      <HistoryDrawerBody open onPickConversation={() => {}} fetchImpl={makeFetch()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("今日话题")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/搜索/);
    await typeIn(input, "感情话");
    await waitFor(() => expect(screen.getByText(/搜索结果/)).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.queryByText(/搜索结果/)).not.toBeInTheDocument();
      expect(screen.getByText("今天")).toBeInTheDocument();
    });
  });

  it("currentId 高亮", async () => {
    const { container } = render(
      <HistoryDrawerBody
        open
        currentId="c-yest"
        onPickConversation={() => {}}
        fetchImpl={makeFetch()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("昨日话题")).toBeInTheDocument();
    });
    const row = container.querySelector('[data-testid="conv-row-c-yest"]');
    expect(row?.className).toContain("lavender");
  });

  it("空搜索结果 → 提示文案", async () => {
    render(
      <HistoryDrawerBody
        open
        onPickConversation={() => {}}
        fetchImpl={makeFetch({ searchHits: [] })}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("今日话题")).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText(/搜索/);
    await typeIn(input, "不存在");
    await waitFor(() => {
      expect(screen.getByText(/没有匹配的对话/)).toBeInTheDocument();
    });
  });

  it("open=false 不拉数据", async () => {
    const fetchImpl = makeFetch();
    render(
      <HistoryDrawerBody open={false} onPickConversation={() => {}} fetchImpl={fetchImpl} />,
    );
    await new Promise((r) => setTimeout(r, 200));
    expect((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0);
  });
});
