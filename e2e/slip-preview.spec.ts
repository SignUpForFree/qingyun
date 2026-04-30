import { test, devices } from "@playwright/test";

test("视觉基线 · slip-preview · iPhone 14（6 等级签卡）", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 14"] });
  const p = await ctx.newPage();
  await p.goto("/slip-preview");
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  await p.screenshot({
    path: "test-results/visual-baseline/slip-preview-iphone14.png",
    fullPage: true,
  });
  await ctx.close();
});

test("API 烟测 · 抽签全链路（建会话 → 抽签 → 验证返回）", async ({ request, page }) => {
  // 拿匿名 cookie
  await page.goto("/");
  // 建档（依赖：抽签需要在某个会话下；先发一条 chat 请求建会话，再抽签）
  await request.post("/api/profile", {
    data: {
      nickname: "签测试",
      gender: "female",
      birth: {
        iso: "2000-08-08T08:00:00+08:00",
        calendarType: "solar",
        hour: 8,
        rawDate: { year: 2000, month: 8, day: 8 },
      },
      region: { province: "上海", city: "上海", longitude: 121.4737, latitude: 31.2304 },
    },
  });

  // 直接 insert 一个会话（用户不一定要先发消息）
  // 实际生产路径是先 POST /api/chat 建会话, 这里手动建以隔离测试
  // 由于我们没有"建会话" endpoint，先 POST /api/chat 让它建（会因为没 DEEPSEEK 走 fallback 但会话已建）
  await request.post("/api/chat", {
    data: { text: "测试占位文本" },
  });

  // 列会话拿 id
  const list = await request.get("/api/chat/conversations");
  const { conversations } = await list.json();
  const conv = conversations[0];
  if (!conv) throw new Error("没拿到会话");

  // 抽签
  const draw = await request.post("/api/divination/qianwen", {
    data: {
      conversationId: conv.id,
      dimension: "事业学业",
      userQuestion: "最近换工作合不合适",
    },
  });

  if (!draw.ok()) {
    const body = await draw.text();
    throw new Error(`抽签失败 ${draw.status()}: ${body}`);
  }

  const data = await draw.json();
  const cardMeta = data.cardMessage?.metadata
    ? JSON.parse(data.cardMessage.metadata)
    : null;
  if (typeof cardMeta?.slipNumber !== "number") {
    throw new Error("cardMessage.metadata.slipNumber 缺失");
  }
  if (cardMeta.slipNumber < 1 || cardMeta.slipNumber > 100) {
    throw new Error(`签号超范围: ${cardMeta.slipNumber}`);
  }
  if (typeof cardMeta.reading !== "string" || cardMeta.reading.length === 0) {
    throw new Error("reading 缺失");
  }
});
