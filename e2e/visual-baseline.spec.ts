import { test, expect, devices } from "@playwright/test";

/**
 * P1 视觉基线截图 — 跑一次存档到 e2e/visual-baseline/
 *
 * 跑：pnpm test:e2e visual-baseline
 *
 * 输出：每个页面 desktop (1280×800) + mobile (iPhone 14 393×852) 各 1 张
 *      共 5 页 × 2 视口 = 10 张图存到 test-results/
 */

const PAGES = [
  { path: "/", name: "home-no-profile" },
  { path: "/onboarding", name: "onboarding-step1" },
  { path: "/chat", name: "chat-welcome" },
  { path: "/chat/new", name: "chat-session-new" },
  { path: "/chat/new?intent=divination", name: "chat-divination-launcher" },
  { path: "/chat/new?intent=dream", name: "chat-dream-launcher" },
  { path: "/chat/new?intent=bazi", name: "chat-bazi-launcher" },
  { path: "/chat/new?intent=meihua", name: "chat-meihua-launcher" },
  { path: "/meihua-preview", name: "meihua-preview" },
  { path: "/fortune/2099-12-31", name: "fortune-detail-future" },
  { path: "/me", name: "me-no-profile" },
] as const;

for (const page of PAGES) {
  test(`视觉基线 · ${page.name} · desktop`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const p = await ctx.newPage();
    await p.goto(page.path);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(800); // 等字体 + watercolor dot 动画稳定
    await p.screenshot({
      path: `test-results/visual-baseline/${page.name}-desktop.png`,
      fullPage: true,
    });
    await ctx.close();
  });

  test(`视觉基线 · ${page.name} · iPhone 14`, async ({ browser }) => {
    const ctx = await browser.newContext({
      ...devices["iPhone 14"],
    });
    const p = await ctx.newPage();
    await p.goto(page.path);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(800);
    await p.screenshot({
      path: `test-results/visual-baseline/${page.name}-iphone14.png`,
      fullPage: true,
    });
    await ctx.close();
  });
}

test("交互冒烟 · onboarding 表单可填", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByPlaceholder(/昵称/).fill("测试小白");
  await page.getByRole("button", { name: "男", exact: true }).click();
  const nextBtn = page.getByRole("button", { name: "下一步", exact: true });
  await expect(nextBtn).toBeEnabled();
});

test("视觉基线 · home-with-fortune · iPhone 14（已建档 + 运势卡）", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 14"] });
  const p = await ctx.newPage();
  // 先访问 / 拿匿名 cookie
  await p.goto("/");
  // POST /api/profile 建档
  const res = await p.request.post("/api/profile", {
    data: {
      nickname: "小白",
      gender: "male",
      birth: {
        iso: "1990-06-15T14:30:00+08:00",
        calendarType: "solar",
        hour: 14,
        rawDate: { year: 1990, month: 6, day: 15 },
      },
      region: { province: "浙江", city: "杭州", longitude: 120.1551, latitude: 30.2741 },
    },
  });
  expect(res.ok()).toBe(true);
  // 重新进首页, 这次会有 DailyFortuneCard
  await p.goto("/");
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1200); // 等 ScoreRing 700ms 动画结束
  await p.screenshot({
    path: "test-results/visual-baseline/home-with-fortune-iphone14.png",
    fullPage: true,
  });
  await ctx.close();
});
