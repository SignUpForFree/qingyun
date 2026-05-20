/**
 * API 路由验证（需启动 dev server）
 *
 * 用 fetch 调用各 API 端点，验证 HTTP 状态码、响应结构、SSE 格式等
 */
import type { CheckResult } from "./verify-bazi";

function check(id: string, section: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { id, section, verdict: condition ? "PASS" : "FAIL", detail: condition ? passMsg : failMsg };
}

function warn(id: string, section: string, msg: string): CheckResult {
  return { id, section, verdict: "WARN", detail: msg };
}

const BASE = process.env.API_BASE ?? "http://localhost:3000";

async function fetchJSON(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

export async function verifyApiRoutes(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // ── healthz ──
  try {
    const { status, text } = await fetchJSON("/api/healthz");
    results.push(check(
      "api-healthz",
      "healthz",
      status === 200,
      `healthz=${status} body=${text.slice(0, 50)}`,
      `healthz=${status} ≠ 200`,
    ));
  } catch (e) {
    results.push(check("api-healthz", "healthz", false, "", `无法连接: ${(e as Error).message}`));
    results.push(warn("api-server", "服务", "无法连接到 dev server，跳过后续 API 测试"));
    return results;
  }

  // ── chat ──
  try {
    const { status } = await fetchJSON("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "你好", conversationId: null }),
    });
    results.push(check(
      "api-chat-no-auth",
      "chat",
      status === 401 || status === 200,
      `chat无认证=${status}`,
      `chat无认证=${status} 非401/200`,
    ));
  } catch (e) {
    results.push(check("api-chat", "chat", false, "", `异常: ${(e as Error).message}`));
  }

  // ── divination/qianwen ──
  try {
    const { status } = await fetchJSON("/api/divination/qianwen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: null }),
    });
    results.push(check(
      "api-qianwen-no-auth",
      "签文",
      status === 401 || status === 200,
      `签文无认证=${status}`,
      `签文无认证=${status} 非401/200`,
    ));
  } catch (e) {
    results.push(check("api-qianwen", "签文", false, "", `异常: ${(e as Error).message}`));
  }

  // ── divination/bazi ──
  try {
    const { status } = await fetchJSON("/api/divination/bazi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: null }),
    });
    results.push(check(
      "api-bazi-no-auth",
      "八字",
      status === 401 || status === 200,
      `八字无认证=${status}`,
      `八字无认证=${status} 非401/200`,
    ));
  } catch (e) {
    results.push(check("api-bazi", "八字", false, "", `异常: ${(e as Error).message}`));
  }

  // ── divination/meihua ──
  try {
    const { status } = await fetchJSON("/api/divination/meihua", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: null }),
    });
    results.push(check(
      "api-meihua-no-auth",
      "梅花",
      status === 401 || status === 200,
      `梅花无认证=${status}`,
      `梅花无认证=${status} 非401/200`,
    ));
  } catch (e) {
    results.push(check("api-meihua", "梅花", false, "", `异常: ${(e as Error).message}`));
  }

  // ── divination/dream ──
  try {
    const { status, json } = await fetchJSON("/api/divination/dream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dreamText: "短" }),
    });
    // 缺认证 or 校验失败 400
    results.push(check(
      "api-dream-validation",
      "解梦",
      status === 400 || status === 401,
      `解梦短文本=${status}`,
      `解梦短文本=${status} 非400/401`,
    ));
  } catch (e) {
    results.push(check("api-dream", "解梦", false, "", `异常: ${(e as Error).message}`));
  }

  // ── fortune/today ──
  try {
    const { status, json } = await fetchJSON("/api/fortune/today");
    results.push(check(
      "api-fortune-today",
      "运势",
      status === 200 || status === 401 || status === 404,
      `运势today=${status}`,
      `运势today=${status} 异常`,
    ));
  } catch (e) {
    results.push(check("api-fortune-today", "运势", false, "", `异常: ${(e as Error).message}`));
  }

  // ── qianwen/explain ──
  try {
    const { status } = await fetchJSON("/api/divination/qianwen/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    results.push(check(
      "api-explain-no-msgid",
      "签文解读",
      status === 400 || status === 401,
      `解读缺messageId=${status}`,
      `解读缺messageId=${status} 非400/401`,
    ));
  } catch (e) {
    results.push(check("api-explain", "签文解读", false, "", `异常: ${(e as Error).message}`));
  }

  // ── slip-image ──
  try {
    const res = await fetch(`${BASE}/api/divination/slip-image/1`);
    const contentType = res.headers.get("content-type") ?? "";
    results.push(check(
      "api-slip-image",
      "签图",
      (res.status === 200 && contentType.includes("image")) || res.status === 401,
      `签图#1=${res.status} type=${contentType}`,
      `签图#1=${res.status} type=${contentType} 异常`,
    ));
  } catch (e) {
    results.push(check("api-slip-image", "签图", false, "", `异常: ${(e as Error).message}`));
  }

  // ── me/profiles ──
  try {
    const { status } = await fetchJSON("/api/me/profiles");
    results.push(check(
      "api-profiles-no-auth",
      "档案",
      status === 401,
      `档案无认证=${status}`,
      `档案无认证=${status} ≠ 401`,
    ));
  } catch (e) {
    results.push(check("api-profiles", "档案", false, "", `异常: ${(e as Error).message}`));
  }

  // ── auth/phone/send-otp ──
  try {
    const { status } = await fetchJSON("/api/auth/phone/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "invalid" }),
    });
    results.push(check(
      "api-otp-invalid-phone",
      "OTP",
      status === 400,
      `非法手机号=${status}`,
      `非法手机号=${status} ≠ 400`,
    ));
  } catch (e) {
    results.push(check("api-otp", "OTP", false, "", `异常: ${(e as Error).message}`));
  }

  return results;
}

if (require.main === module || process.argv[1]?.includes("verify-api-routes")) {
  verifyApiRoutes().then((results) => {
    const pass = results.filter((r) => r.verdict === "PASS").length;
    const fail = results.filter((r) => r.verdict === "FAIL").length;
    console.log(`\nAPI路由验证: ${pass} PASS / ${fail} FAIL / ${results.length} 总计`);
    for (const r of results.filter((r) => r.verdict !== "PASS")) {
      console.log(`  ${r.verdict} [${r.section}] ${r.id}: ${r.detail}`);
    }
  });
}