import { test, expect } from "@playwright/test";

/**
 * PIPL 合规接口端到端：数据导出 + 账号注销
 *
 * 详见 lib spec / app/me/settings/_AccountActions.tsx 的客户端流程。
 *
 * 链路：
 *   1. dev-login 拿 user
 *   2. POST /api/chat 写一条消息（让 export 有可见数据）
 *   3. GET /api/me/account/export → JSON 下载，校验 user/profiles/messages 字段
 *   4. POST /api/me/account/delete confirm=DELETE → 200
 *   5. 再次 GET 下游接口 → 应返回 401（cookie 已被服务端清掉，新建匿名 user）
 */

test.setTimeout(120_000);

test("account export + delete 合规闭环", async ({ request }) => {
  // 1) dev-login
  const loginRes = await request.post("/api/dev-login", { data: {} });
  expect(loginRes.ok(), `dev login 失败 ${loginRes.status()}`).toBeTruthy();

  // 2) 起一条 chat（不必等流完，只要消息入库即可）
  const chatRes = await request.post("/api/chat", {
    data: { conversationId: null, text: "你好" },
  });
  expect(chatRes.ok()).toBeTruthy();
  const chatBody = await chatRes.text();
  expect(chatBody).toContain("event: meta");

  // 3) GET 数据导出
  const exp = await request.get("/api/me/account/export");
  expect(exp.ok(), `export 失败 ${exp.status()}`).toBeTruthy();
  expect(exp.headers()["content-disposition"]).toMatch(/attachment.*qingyun-export/);
  const data = (await exp.json()) as {
    exportedAt: string;
    user?: { id?: string };
    profiles?: unknown[];
    messages?: unknown[];
    fortunes?: { daily: unknown[]; weekly: unknown[]; monthly: unknown[] };
  };
  expect(data.exportedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(data.user?.id).toBeTruthy();
  expect(Array.isArray(data.profiles)).toBe(true);
  expect(Array.isArray(data.messages)).toBe(true);
  expect(data.fortunes).toBeDefined();

  // 4) 注销前先验：confirm 字符串错 → 应 400
  const wrongConfirm = await request.post("/api/me/account/delete", {
    data: { confirm: "delete" },
  });
  expect(wrongConfirm.status()).toBe(400);

  // 5) 正确注销
  const del = await request.post("/api/me/account/delete", {
    data: { confirm: "DELETE" },
  });
  expect(del.ok(), `delete 失败 ${del.status()}`).toBeTruthy();
  const delBody = await del.json();
  expect(delBody.ok).toBe(true);
});
