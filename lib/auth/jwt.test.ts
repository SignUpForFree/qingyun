import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractBearer, JwtError, signJwt, verifyJwt } from "./jwt";

describe("JWT HS256 sign/verify", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "x".repeat(64);
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("sign + verify round-trip retains sub", () => {
    const t = signJwt({ sub: "user-1" });
    const p = verifyJwt(t);
    expect(p.sub).toBe("user-1");
    expect(typeof p.iat).toBe("number");
    expect(typeof p.exp).toBe("number");
  });

  it("preserves custom claims", () => {
    const t = signJwt({ sub: "u", openid: "ox-1" });
    const p = verifyJwt(t);
    expect(p.openid).toBe("ox-1");
  });

  it("throws on tampered signature", () => {
    const t = signJwt({ sub: "u" });
    const parts = t.split(".");
    const bad = `${parts[0]}.${parts[1]}.aaaaaa`;
    expect(() => verifyJwt(bad)).toThrow(JwtError);
  });

  it("throws on expired token", () => {
    const t = signJwt({ sub: "u" }, { expiresInSec: 1 });
    // 手动 sleep 不实用；构造已过期 token：用过期 exp 直接 sign
    const past = signJwt({ sub: "u", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(() => verifyJwt(past)).toThrow(/expired/);
    // 当前 token 仍有效
    expect(verifyJwt(t).sub).toBe("u");
  });

  it("throws on alg=none confusion attack", () => {
    // 构造 alg=none 的伪 JWT
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "evil" })).toString("base64url");
    const fake = `${header}.${payload}.`;
    expect(() => verifyJwt(fake)).toThrow(/unsupported alg/);
  });

  it("throws on empty / malformed token", () => {
    expect(() => verifyJwt("")).toThrow(JwtError);
    expect(() => verifyJwt("only.two.parts.is.too.many")).toThrow(JwtError);
    expect(() => verifyJwt("a.b")).toThrow(JwtError);
  });

  it("throws when SESSION_SECRET missing", () => {
    delete process.env.SESSION_SECRET;
    expect(() => signJwt({ sub: "u" })).toThrow(/SESSION_SECRET missing/);
  });
});

describe("extractBearer", () => {
  it("returns the token after 'Bearer '", () => {
    expect(extractBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });
  it("case-insensitive Bearer prefix", () => {
    expect(extractBearer("bearer abc")).toBe("abc");
  });
  it("returns null when missing or invalid", () => {
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
    expect(extractBearer("Basic xxx")).toBeNull();
    expect(extractBearer("")).toBeNull();
  });
});
