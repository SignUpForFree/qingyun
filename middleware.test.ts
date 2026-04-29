import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// session.ts imports "server-only" — strip it under jsdom test env.
vi.mock("server-only", () => ({}));

const { middleware } = await import("./middleware");

/**
 * 鉴权 middleware 测试（V2 弹窗登录）
 *
 * 注意：V2 起页面路由不再 redirect，由 LoginGate（client）触发 Sheet 弹窗；
 * middleware 只负责放行公开前缀，私有 API 拦截为 401 JSON。
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

  it("missing session + wechat UA -> page passes through (LoginGate client-side)", () => {
    const r = middleware(req("/me", { ua: WECHAT_UA }));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("missing session + browser UA -> page passes through (LoginGate client-side)", () => {
    const r = middleware(req("/me"));
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
