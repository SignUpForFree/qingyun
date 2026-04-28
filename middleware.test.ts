import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// session.ts imports "server-only" — strip it under jsdom test env.
vi.mock("server-only", () => ({}));

const { middleware } = await import("./middleware");

/**
 * 鉴权 middleware 测试 — 6 路径
 *
 * 注意：plan 模板里写了 7 条（含两条 wechat_bind DB 检查），但 Edge runtime
 * 不能 import better-sqlite3，所以 bind 完整性校验下放到 page/route layer。
 * 这里只覆盖白名单 + cookie 存在性。
 */

function req(
  path: string,
  opts?: { cookie?: string; ua?: string },
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  const headers = new Headers();
  if (opts?.cookie) headers.set("cookie", opts.cookie);
  if (opts?.ua) headers.set("user-agent", opts.ua);
  return new NextRequest(url, { headers });
}

const WECHAT_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40";

describe("middleware", () => {
  it("/legal/privacy passes through (no cookie)", () => {
    const r = middleware(req("/legal/privacy"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("/api/healthz passes through (no cookie)", () => {
    const r = middleware(req("/api/healthz"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("/api/auth/wechat passes through (no cookie)", () => {
    const r = middleware(req("/api/auth/wechat"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("missing session + wechat UA -> 307 redirect to /api/auth/wechat", () => {
    const r = middleware(req("/me", { ua: WECHAT_UA }));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/api/auth/wechat");
  });

  it("missing session + browser UA -> 307 redirect to /login", () => {
    const r = middleware(req("/me"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/login");
  });

  it("/login passes through (no cookie)", () => {
    const r = middleware(req("/login"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("/api/auth/phone/send-otp passes through (no cookie)", () => {
    const r = middleware(req("/api/auth/phone/send-otp"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("/api/auth/phone/verify passes through (no cookie)", () => {
    const r = middleware(req("/api/auth/phone/verify"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("missing session on an API route -> 401 JSON", async () => {
    const r = middleware(req("/api/me/profiles"));
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("session cookie present -> pass through", () => {
    const r = middleware(req("/me", { cookie: "qy_uid=abc-123" }));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });
});
