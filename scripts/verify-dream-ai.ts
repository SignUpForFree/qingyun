/**
 * 本地解梦 AI 联调：走真实 /api/divination/dream（需 pnpm dev + .env.local 网关 key）
 *
 *   pnpm exec tsx scripts/verify-dream-ai.ts
 *   BASE_URL=http://127.0.0.1:3000 pnpm exec tsx scripts/verify-dream-ai.ts
 */
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const DREAM_TEXT = "我梦到我到河里抓鱼，抓了好多好多鱼，都装不下了";

function cookieHeaderFrom(res: Response): string {
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (getSetCookie) {
    return getSetCookie
      .call(res.headers)
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(/,(?=\s*[^;]+=)/).map((c) => c.split(";")[0]!.trim()).join("; ") : "";
}

async function readSseBody(res: Response): Promise<string> {
  return await res.text();
}

async function devLogin(): Promise<string> {
  const res = await fetch(`${BASE}/api/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`dev-login 失败 ${res.status}: ${await res.text()}`);
  }
  const cookie = cookieHeaderFrom(res);
  if (!cookie) throw new Error("dev-login 未返回 Set-Cookie");
  return cookie;
}

function extractConversationId(sse: string): string | null {
  const m = sse.match(/"conversationId"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function extractDreamCardContent(sse: string): string {
  const cardLines = sse.split("\n").filter((l) => l.startsWith('data: {"id"'));
  for (let i = cardLines.length - 1; i >= 0; i--) {
    try {
      const payload = JSON.parse(cardLines[i]!.slice(6)) as {
        content?: string;
        metadata?: string;
      };
      const meta = payload.metadata ? JSON.parse(payload.metadata) : {};
      if (meta.ui === "dream_result_fast" || meta.ui === "dream_result_precise") {
        return payload.content ?? "";
      }
    } catch {
      /* next */
    }
  }
  return "";
}

function hasEvent(sse: string, event: string): boolean {
  return sse.includes(`event: ${event}`);
}

async function main() {
  console.log(`▶ 解梦联调 BASE=${BASE}`);

  const health = await fetch(`${BASE}/api/healthz`);
  if (!health.ok) {
    console.error("✗ 服务未就绪，请先 pnpm dev");
    process.exit(1);
  }

  const cookie = await devLogin();
  console.log("  dev-login ok");

  const chatRes = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ text: "我要解梦", conversationId: null }),
  });
  if (!chatRes.ok) {
    console.error("✗ /api/chat 失败", chatRes.status, await chatRes.text());
    process.exit(1);
  }
  const chatSse = await readSseBody(chatRes);
  const conversationId = extractConversationId(chatSse);
  if (!conversationId) {
    console.error("✗ 未从 chat SSE 解析到 conversationId");
    process.exit(1);
  }
  console.log(`  conversationId=${conversationId}`);

  const dreamRes = await fetch(`${BASE}/api/divination/dream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      conversationId,
      mode: "fast",
      dream: DREAM_TEXT,
    }),
  });

  if (dreamRes.status === 503) {
    console.error("✗ AI 网关未配置（503），请检查 .env.local 的 AI_GATEWAY_API_KEY");
    process.exit(1);
  }
  if (!dreamRes.ok) {
    console.error("✗ /api/divination/dream HTTP", dreamRes.status, await dreamRes.text());
    process.exit(1);
  }

  const dreamSse = await readSseBody(dreamRes);
  if (hasEvent(dreamSse, "error")) {
    console.error("✗ SSE error 事件（模型未返回正文）");
    console.error(dreamSse.slice(0, 800));
    process.exit(1);
  }

  const content = extractDreamCardContent(dreamSse);
  const len = [...content].length;
  console.log(`  解读字数（字符）≈ ${len}`);
  console.log(`  预览：\n${content.slice(0, 280)}${len > 280 ? "…" : ""}`);

  if (len < 80) {
    console.error("✗ 正文过短，可能仍未调通大模型");
    process.exit(1);
  }
  if (len >= 500 && len <= 800) {
    console.log("✓ 字数落在 prompt 目标区间 500–800");
  } else if (len > 800) {
    console.log(`⚠ 字数 ${len} 超出 800（模型略长，可接受）`);
  } else {
    console.log(`⚠ 字数 ${len} 短于 500（模型略短，但已有实质解读）`);
  }

  if (content.includes("梦境核心解析") || content.includes("潜意识")) {
    console.log("✓ 含结构化段落");
  }
  console.log("✓ 解梦联调通过");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
