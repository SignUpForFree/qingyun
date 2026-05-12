import { test, expect } from "@playwright/test";

/**
 * 周/月 fortune AI 升级接口（SWR）冒烟
 *
 * 仅验证：
 *   - 401/404 等鉴权 / 校验路径正常
 *   - 鉴权通过 + body 合法 → 返回 200，body.regenerated 是布尔
 *
 * 不强行验 AI 真生效（AI 可能 fallback ai_failed/ai_format_invalid），
 * 那两类 reason 都属正常返回（200，不刷新但不报错）。
 */
test.setTimeout(120_000);

test.describe("fortune weekly/monthly regenerate", () => {
  test("weekly: validation + happy path", async ({ request }) => {
    const login = await request.post("/api/dev-login", { data: {} });
    expect(login.ok()).toBeTruthy();

    // 缺 anchorDate → 400
    const bad = await request.post("/api/fortune/weekly/regenerate", {
      data: {},
    });
    expect(bad.status()).toBe(400);

    // 合法日期
    const today = new Date().toISOString().slice(0, 10);
    const ok = await request.post("/api/fortune/weekly/regenerate", {
      data: { anchorDate: today },
    });
    // 用户在 dev-login 后没有完整档案（只有 placeholder），应当 404 no_profile
    // 或 200 already_ai / ai_failed / db_update_failed 等
    expect([200, 404]).toContain(ok.status());
    const data = await ok.json();
    if (ok.status() === 200) {
      expect(typeof data.regenerated === "boolean" || data.reason).toBeTruthy();
    } else {
      expect(data.reason).toBe("no_profile");
    }
  });

  test("monthly: validation + happy path", async ({ request }) => {
    const login = await request.post("/api/dev-login", { data: {} });
    expect(login.ok()).toBeTruthy();

    const bad = await request.post("/api/fortune/monthly/regenerate", {
      data: { anchorDate: "not-a-date" },
    });
    expect(bad.status()).toBe(400);

    const today = new Date().toISOString().slice(0, 10);
    const ok = await request.post("/api/fortune/monthly/regenerate", {
      data: { anchorDate: today },
    });
    expect([200, 404]).toContain(ok.status());
  });
});
