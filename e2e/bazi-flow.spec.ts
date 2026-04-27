import { test, expect } from "@playwright/test";

/**
 * M3.14 八字 V2 流程烟测
 *
 * 走完一条完整链路：
 *   1. /api/chat 起会话（拿 conversationId）
 *   2. /api/divination/bazi 仅 conversationId → Branch A profile_picker / quick_form
 *   3. /api/divination/bazi 带 quickFormData → Branch B 建档 + focus_picker
 *   4. /api/divination/bazi 带 profileId + focus → Branch D SSE 流式生成
 *
 * Branch D 校验 SSE 协议级两条合法路径：
 *   - 成功路径：meta → progress → token+ → card(metadata 含 V2 chart) → done
 *   - AI 失败路径：meta → progress → error
 *
 * V2 chart 结构断言：shensha 数组 / yongShen 对象 / luckPillars 8 步 / liunian 含 (本年)
 */

interface SseEvent {
  event: string;
  data: string;
}

function parseSse(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const block of raw.split(/\n\n+/)) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split(/\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n") });
  }
  return events;
}

// AI 真跑要 25-60s，2 次 Branch D 加 cleanup 给 180s 上限
test.setTimeout(180_000);

test("bazi V2 端到端：建档 → focus → SSE → V2 chart", async ({ request }) => {
  // 0) dev-only login 捷径：建 user + 写 qy_uid cookie 到 request context
  const loginRes = await request.post("/api/dev-login", { data: {} });
  expect(loginRes.ok(), `dev login 失败 ${loginRes.status()}`).toBeTruthy();

  // 1) 起会话
  const chatRes = await request.post("/api/chat", {
    data: { conversationId: null, text: "你好" },
  });
  expect(chatRes.ok()).toBeTruthy();
  const chatBody = await chatRes.text();
  const metaMatch = chatBody.match(/event: meta\s*\ndata: (\{[^}]+\})/);
  expect(metaMatch, "chat 应回 meta event").not.toBeNull();
  const convId = JSON.parse(metaMatch![1]).conversationId as string;
  expect(convId).toBeTruthy();

  // 2) Branch A：仅 conversationId → profile_picker 或 quick_form
  const aRes = await request.post("/api/divination/bazi", {
    data: { conversationId: convId },
  });
  expect(aRes.ok()).toBeTruthy();
  const aData = await aRes.json();
  expect(["profile_picker", "quick_form_needed"]).toContain(aData.step);

  // 3) Branch B：quickFormData → 建档 + focus_picker
  const bRes = await request.post("/api/divination/bazi", {
    data: {
      conversationId: convId,
      quickFormData: {
        gender: "female",
        birth_time: "1995-03-22 09:00",
        birth_place: "上海",
      },
    },
  });
  expect(bRes.ok()).toBeTruthy();
  const bData = await bRes.json();
  expect(bData.step).toBe("profile_created_focus_picker");
  const profileId = bData.profileId as string;
  expect(profileId).toBeTruthy();

  // 4) Branch D：profileId + focus → SSE 流
  const dRes = await request.post("/api/divination/bazi", {
    data: {
      conversationId: convId,
      profileId,
      focus: "事业学业",
    },
  });
  expect(dRes.ok()).toBeTruthy();
  expect(dRes.headers()["content-type"]).toMatch(/text\/event-stream/);

  const sseRaw = await dRes.text();
  const events = parseSse(sseRaw);
  expect(events.length).toBeGreaterThan(0);

  // 第一帧必为 meta
  expect(events[0].event).toBe("meta");
  const meta = JSON.parse(events[0].data);
  expect(meta.intent).toBe("bazi");
  expect(meta.profileId).toBe(profileId);
  expect(meta.focus).toBe("事业学业");

  // 应至少有一帧 progress
  const progressFrames = events.filter((e) => e.event === "progress");
  expect(progressFrames.length).toBeGreaterThan(0);

  // 终态：card+done OR error，二选一
  const lastNonHeartbeat = events
    .filter((e) => e.event !== "heartbeat" && e.event !== "ping")
    .at(-1);
  expect(lastNonHeartbeat).toBeDefined();
  const terminalEvents = events.filter((e) => ["card", "done", "error"].includes(e.event));
  expect(terminalEvents.length).toBeGreaterThan(0);

  const cardEvent = events.find((e) => e.event === "card");
  const errorEvent = events.find((e) => e.event === "error");

  if (cardEvent) {
    // 成功路径：V2 chart 完整断言
    const card = JSON.parse(cardEvent.data);
    const cardMeta = JSON.parse(card.metadata);
    expect(cardMeta.ui).toBe("bazi_result");
    expect(cardMeta.profileId).toBe(profileId);
    expect(cardMeta.focus).toBe("事业学业");

    // V2 chart 必有 shensha 数组 + yongShen 对象 + luckPillars 8 步 + liunian 含本年
    expect(Array.isArray(cardMeta.chart.shensha)).toBe(true);
    expect(cardMeta.chart.yongShen).toBeDefined();
    expect(typeof cardMeta.chart.yongShen.gejuType).toBe("string");
    expect(["金", "木", "水", "火", "土"]).toContain(cardMeta.chart.yongShen.yongShen);
    expect(Array.isArray(cardMeta.chart.luckPillars)).toBe(true);
    expect(cardMeta.chart.luckPillars.length).toBe(8);
    expect(Array.isArray(cardMeta.chart.liunian)).toBe(true);
    expect(cardMeta.chart.liunian.some((l: { offset: number }) => l.offset === 0)).toBe(true);

    // done 必在 card 之后
    const doneEvent = events.find((e) => e.event === "done");
    expect(doneEvent).toBeDefined();
  } else if (errorEvent) {
    // 容忍 AI 失败：只校验 error frame 结构
    const err = JSON.parse(errorEvent.data);
    expect(typeof err.message).toBe("string");
    expect(typeof err.retryable).toBe("boolean");
    test.info().annotations.push({
      type: "warn",
      description: `AI 失败兜底：${err.code ?? "unknown"} — ${err.message}`,
    });
  } else {
    throw new Error("既无 card 也无 error event，SSE 流不完整");
  }

  // 5) 二次 hit：缓存路径（profile.bazi_pillars 已写入，pillars 计算应一致）
  const dRes2 = await request.post("/api/divination/bazi", {
    data: { conversationId: convId, profileId, focus: "财运" },
  });
  expect(dRes2.ok()).toBeTruthy();
  const sse2 = await dRes2.text();
  const events2 = parseSse(sse2);
  const cardEvent2 = events2.find((e) => e.event === "card");
  if (cardEvent2) {
    const cardMeta2 = JSON.parse(JSON.parse(cardEvent2.data).metadata);
    if (cardEvent) {
      const cardMeta1 = JSON.parse(JSON.parse(cardEvent.data).metadata);
      // pillars 不应变化
      expect(cardMeta2.chart.pillars).toEqual(cardMeta1.chart.pillars);
      expect(cardMeta2.chart.dayMaster).toBe(cardMeta1.chart.dayMaster);
    }
  }

  // 6) 清理会话
  await request.delete(`/api/conversations/${convId}`);
});
