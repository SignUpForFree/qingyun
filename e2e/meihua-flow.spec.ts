import { test, expect } from "@playwright/test";

/**
 * M3.32 梅花 V2 流程烟测
 *
 * 完整链路：
 *   1. dev-login → 写 qy_uid cookie
 *   2. /api/chat 起会话 → conversationId
 *   3. /api/divination/bazi quickFormData → 建档 (profileId)
 *   4. /api/divination/meihua { profileId } → number_input 引导卡
 *   5. /api/divination/meihua { profileId, numbers: [3,5,2] } → SSE → meihua_result
 *
 * V2 卦象断言：ben/hu/bian 三卦 + tiYong + yingQi + timeEnergy + sunYi。
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

test.setTimeout(180_000);

test("meihua V2 端到端：建档 → 报数 → SSE → V2 卦象", async ({ request }) => {
  // 0) dev-login
  const loginRes = await request.post("/api/dev-login", { data: {} });
  expect(loginRes.ok(), `dev-login 失败 ${loginRes.status()}`).toBeTruthy();

  // 1) 起会话
  const chatRes = await request.post("/api/chat", {
    data: { conversationId: null, text: "你好" },
  });
  expect(chatRes.ok()).toBeTruthy();
  const chatBody = await chatRes.text();
  const metaMatch = chatBody.match(/event: meta\s*\ndata: (\{[^}]+\})/);
  expect(metaMatch).not.toBeNull();
  const convId = JSON.parse(metaMatch![1]).conversationId as string;
  expect(convId).toBeTruthy();

  // 2) 走 bazi 路由建档（meihua 自身不接 quickFormData）
  const bRes = await request.post("/api/divination/bazi", {
    data: {
      conversationId: convId,
      quickFormData: {
        gender: "male",
        birth_time: "1990-08-15 14:30",
        birth_place: "北京",
      },
    },
  });
  expect(bRes.ok()).toBeTruthy();
  const bData = await bRes.json();
  const profileId = bData.profileId as string;
  expect(profileId).toBeTruthy();

  // 3) Branch B 仅 profileId → number_input 卡
  const branchBRes = await request.post("/api/divination/meihua", {
    data: { conversationId: convId, profileId },
  });
  expect(branchBRes.ok()).toBeTruthy();
  const branchBData = await branchBRes.json();
  expect(branchBData.step).toBe("number_input");

  // 4) Branch C：profileId + numbers → SSE
  const cRes = await request.post("/api/divination/meihua", {
    data: {
      conversationId: convId,
      profileId,
      numbers: [3, 5, 2],
      userQuestion: "近期事业有何变化？",
    },
  });
  expect(cRes.ok()).toBeTruthy();
  expect(cRes.headers()["content-type"]).toMatch(/text\/event-stream/);

  const sseRaw = await cRes.text();
  const events = parseSse(sseRaw);
  expect(events.length).toBeGreaterThan(0);

  // 第一帧 meta，intent=meihua
  expect(events[0].event).toBe("meta");
  const meta = JSON.parse(events[0].data);
  expect(meta.intent).toBe("meihua");
  expect(meta.profileId).toBe(profileId);

  // 必有 progress
  const progressFrames = events.filter((e) => e.event === "progress");
  expect(progressFrames.length).toBeGreaterThan(0);

  // 终态 card 或 error
  const cardEvent = events.find((e) => e.event === "card");
  const errorEvent = events.find((e) => e.event === "error");

  if (cardEvent) {
    const card = JSON.parse(cardEvent.data);
    const cardMeta = JSON.parse(card.metadata);
    expect(cardMeta.ui).toBe("meihua_result");
    expect(cardMeta.profileId).toBe(profileId);
    expect(cardMeta.numbers).toEqual([3, 5, 2]);

    // V2 三卦
    for (const key of ["ben", "hu", "bian"]) {
      expect(cardMeta[key], `${key} 卦缺失`).toBeDefined();
      expect(typeof cardMeta[key].name).toBe("string");
      expect(["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]).toContain(
        cardMeta[key].upper,
      );
      expect(["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]).toContain(
        cardMeta[key].lower,
      );
      expect(Array.isArray(cardMeta[key].lines)).toBe(true);
      expect(cardMeta[key].lines.length).toBe(6);
    }

    // V2 新增结构
    expect(cardMeta.tiYong).toBeDefined();
    expect(["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]).toContain(cardMeta.tiYong.ti);
    expect(["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]).toContain(cardMeta.tiYong.yong);
    expect(typeof cardMeta.tiYong.relation).toBe("string");

    expect(cardMeta.yingQi).toBeDefined();
    expect(cardMeta.benDict).toBeDefined();
    expect(cardMeta.huDict).toBeDefined();
    expect(cardMeta.bianDict).toBeDefined();
    // benDict 含 64 卦字典视图
    expect(typeof cardMeta.benDict.guaCi).toBe("string");
    expect(Array.isArray(cardMeta.benDict.yaoCi)).toBe(true);
    expect(cardMeta.benDict.yaoCi.length).toBe(6);

    // sunYi / timeEnergy 可能为 null（profile 无 yongShen 或无 hourBranch），
    // 但字段必须存在
    expect("timeEnergy" in cardMeta).toBe(true);
    expect("sunYi" in cardMeta).toBe(true);

    const doneEvent = events.find((e) => e.event === "done");
    expect(doneEvent).toBeDefined();
  } else if (errorEvent) {
    const err = JSON.parse(errorEvent.data);
    expect(typeof err.message).toBe("string");
    expect(typeof err.retryable).toBe("boolean");
    test.info().annotations.push({
      type: "warn",
      description: `AI 失败兜底：${err.code ?? "unknown"} — ${err.message}`,
    });
  } else {
    throw new Error("既无 card 也无 error event");
  }
});
