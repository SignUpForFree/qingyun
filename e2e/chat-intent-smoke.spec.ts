import { test, expect } from "@playwright/test";

/**
 * M2.30 — 4 大意图烟测（V2.0 路由器 + 22 ui 卡片）
 *
 * 关键路径：
 *   1. divination：/chat?intent=divination → launcher → type picker → question →
 *      drawing → image → 静态报告
 *   2. dream(fast)：?intent=dream → method picker (fast) → 输入梦境 → result
 *   3. bazi：?intent=bazi → profile picker（无档时降级 quick_form）→ focus → result
 *   4. meihua：?intent=meihua → profile picker → 数字 → result
 *
 * 假设：
 *   - 此 spec 依赖本地 dev server（playwright.config.ts 自动启）+ AI 网关在线（fallback 兜底也行）
 *   - 跨 cookie 共享 storage：不区分 user，按 anon cookie 走
 *   - 断言只校验关键卡片渲染（DOM 含某 data-testid 或文本），不校验 AI 文本质量
 */

test.describe("chat intent smoke (M2.30)", () => {
  test("divination: ?intent=divination → 引导卡链路", async ({ page }) => {
    await page.goto("/chat?intent=divination");

    // 自动 send 后应该出现 type picker 卡（或 launcher）
    // V2.0 关键卡片：slip_type_picker / slip_question_input / slip_drawing / slip_image / slip_report
    await expect(page.locator("body")).toContainText(/抽签|抽灵签|签|占卜/i, { timeout: 30_000 });

    // 至少能看到一个 option 让用户选维度
    const dimChip = page
      .locator("button")
      .filter({ hasText: /综合|事业|财运|感情|人际|平安/i })
      .first();
    await expect(dimChip).toBeVisible({ timeout: 30_000 });
  });

  test("dream fast: ?intent=dream → method picker / 输入框", async ({ page }) => {
    await page.goto("/chat?intent=dream");
    await expect(page.locator("body")).toContainText(/解梦|梦/i, { timeout: 30_000 });
  });

  test("bazi: ?intent=bazi → profile picker 或 quick form", async ({ page }) => {
    await page.goto("/chat?intent=bazi");
    await expect(page.locator("body")).toContainText(/八字|档案|出生/i, { timeout: 30_000 });
  });

  test("meihua: ?intent=meihua → profile picker 或数字录入", async ({ page }) => {
    await page.goto("/chat?intent=meihua");
    await expect(page.locator("body")).toContainText(/测算|梅花|数字|档案/i, {
      timeout: 30_000,
    });
  });
});
