import { test, expect } from "@playwright/test";

test("healthz responds with 200 and ok", async ({ request }) => {
  const res = await request.get("/api/healthz");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
});
