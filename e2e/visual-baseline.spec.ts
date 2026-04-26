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
