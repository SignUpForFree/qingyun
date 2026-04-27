import { test, expect } from "@playwright/test";

/**
 * M3.33 历史搜索 e2e
 *
 * 验证 /api/chat/conversations/search 在用户隔离 + 3+ 字阈值 + FTS5 命中之外
 * 也能在不同 query 下正常返回 20 内 hits。
 *
 * 步骤：
 *   1. dev-login（拿 qy_uid）
 *   2. /api/chat 起 3 条不同主题的会话，发不同关键句
 *   3. GET /api/chat/conversations/search?q=<keyword>
 *   4. 校验：包含命中关键词的 conversation id；snippet 含 <b>...</b> 高亮
 *   5. 短 query (<3) → 400 校验错误
 *   6. 命中数 ≤ 20
 */

interface SearchItem {
  id: string;
  title: string;
  lastMessageAt: string | null;
  snippet: string;
}

async function startConversationWithText(
  request: import("@playwright/test").APIRequestContext,
  text: string,
): Promise<string> {
  const res = await request.post("/api/chat", {
    data: { conversationId: null, text },
  });
  expect(res.ok(), `chat 失败 ${res.status()}`).toBeTruthy();
  const raw = await res.text();
  const m = raw.match(/event: meta\s*\ndata: (\{[^}]+\})/);
  expect(m).not.toBeNull();
  return JSON.parse(m![1]).conversationId as string;
}

test.setTimeout(120_000);

test("history search e2e: 3 字阈值 + 关键词命中 + 20 hit 上限", async ({ request }) => {
  // 0) login
  const loginRes = await request.post("/api/dev-login", { data: {} });
  expect(loginRes.ok()).toBeTruthy();

  // 1) 起 3 条不同主题会话
  const conv1 = await startConversationWithText(request, "今天工作 PUA 严重");
  const conv2 = await startConversationWithText(request, "公司氛围比较温柔");
  const conv3 = await startConversationWithText(request, "想看看最近的财运怎么样");
  expect(conv1).not.toBe(conv2);
  expect(conv2).not.toBe(conv3);

  // 2) FTS5 触发器是写入时实时同步的，不需要等。但 SQLite WAL 同步保险等 200ms
  await new Promise((r) => setTimeout(r, 200));

  // 3) 搜 "财运" 应命中 conv3
  const r1 = await request.get("/api/chat/conversations/search?q=财运");
  expect(r1.ok(), `search 失败 ${r1.status()}`).toBeTruthy();
  const body1 = (await r1.json()) as { items: SearchItem[]; count: number; q: string };
  expect(body1.q).toBe("财运");
  expect(body1.count).toBeLessThanOrEqual(20);
  const ids1 = body1.items.map((i) => i.id);
  expect(ids1, "财运 query 未命中 conv3").toContain(conv3);

  // snippet 高亮 <b>...</b>
  const conv3Hit = body1.items.find((i) => i.id === conv3)!;
  expect(conv3Hit.snippet).toContain("<b>");
  expect(conv3Hit.snippet).toContain("</b>");

  // 4) 搜 "工作" 应命中 conv1（3+ 字才会触 trigram）
  const r2 = await request.get("/api/chat/conversations/search?q=工作PUA");
  expect(r2.ok()).toBeTruthy();
  const body2 = (await r2.json()) as { items: SearchItem[]; count: number };
  const ids2 = body2.items.map((i) => i.id);
  expect(ids2).toContain(conv1);

  // 5) 短 query (<3) 应 400
  const rShort = await request.get("/api/chat/conversations/search?q=ab");
  expect(rShort.status()).toBe(400);

  // 6) 不存在的关键词 → 0 hits
  const rEmpty = await request.get(
    "/api/chat/conversations/search?q=" + encodeURIComponent("绝不应该出现的字"),
  );
  expect(rEmpty.ok()).toBeTruthy();
  const bodyEmpty = (await rEmpty.json()) as { count: number; items: unknown[] };
  expect(bodyEmpty.count).toBe(0);
  expect(bodyEmpty.items).toEqual([]);
});
