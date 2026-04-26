import { test } from "@playwright/test";

/**
 * 全 divination API 烟测（V1.0 文档对齐版）
 *
 * 流程：
 *   1. 建档（profile + bazi_chart）
 *   2. /api/chat 触发分流（'我要测算' → meihua intent → card 事件）
 *   3. 各 sub-action API 走"卡片提交"模式（必须含 conversationId）
 *
 * 注：所有路由 AI fallback 走兜底文案，不影响断言；只校验路由能跑通 + 关键字段。
 */

test("API 烟测 · /api/chat 分流 + 4 sub-action 全链路", async ({ request, page }) => {
  await page.goto("/");

  // 1) 建档
  const profileRes = await request.post("/api/profile", {
    data: {
      nickname: "API测试",
      gender: "female",
      birth: {
        iso: "2000-08-08T08:00:00+08:00",
        calendarType: "solar",
        hour: 8,
        rawDate: { year: 2000, month: 8, day: 8 },
      },
      region: {
        province: "上海",
        city: "上海",
        longitude: 121.4737,
        latitude: 31.2304,
      },
    },
  });
  if (!profileRes.ok()) {
    throw new Error(`建档失败 ${profileRes.status()}: ${await profileRes.text()}`);
  }

  // 2) /api/chat 起新会话（'你好' → chat intent，流式）
  const chatRes = await request.post("/api/chat", {
    data: { conversationId: null, text: "你好" },
  });
  if (!chatRes.ok()) {
    throw new Error(`/api/chat 失败 ${chatRes.status()}: ${await chatRes.text()}`);
  }
  // 取出 SSE 流里的 conversationId（meta event）
  const chatBody = await chatRes.text();
  const metaMatch = chatBody.match(/event: meta\s*\ndata: (\{[^}]+\})/);
  if (!metaMatch) throw new Error("没收到 meta event");
  const meta = JSON.parse(metaMatch[1]);
  if (!meta.conversationId) throw new Error("meta 缺 conversationId");
  const convId = meta.conversationId as string;

  // 3) qianwen sub-action（必须含 conversationId + 6 类新 dimension）
  const qianwenRes = await request.post("/api/divination/qianwen", {
    data: {
      conversationId: convId,
      dimension: "事业学业",
      userQuestion: "最近换工作合不合适",
    },
  });
  if (!qianwenRes.ok()) {
    throw new Error(`抽签失败 ${qianwenRes.status()}: ${await qianwenRes.text()}`);
  }
  const qianwenData = await qianwenRes.json();
  if (typeof qianwenData.cardMessage?.metadata !== "string") {
    throw new Error("qianwen 缺 cardMessage.metadata");
  }
  const cardMeta = JSON.parse(qianwenData.cardMessage.metadata);
  if (cardMeta.ui !== "slip_image") {
    throw new Error(`cardMessage.metadata.ui 错: ${cardMeta.ui}`);
  }

  // 4) dream fast 模式
  const dreamRes = await request.post("/api/divination/dream", {
    data: {
      conversationId: convId,
      mode: "fast",
      payload: {
        dreamText: "梦见自己在云海上飞，下面有人在喊我的名字，醒来心里很平静",
        emotion: "平静",
      },
    },
  });
  if (!dreamRes.ok()) {
    throw new Error(`解梦失败 ${dreamRes.status()}: ${await dreamRes.text()}`);
  }
  const dreamData = await dreamRes.json();
  if (typeof dreamData.resultMessage?.content !== "string") {
    throw new Error("dream 响应缺 resultMessage.content");
  }

  // 5) bazi sub-action（依赖默认 profile）
  const baziRes = await request.post("/api/divination/bazi", {
    data: {
      conversationId: convId,
      focus: "事业学业",
      userQuestion: "最近换工作合不合适",
    },
  });
  if (!baziRes.ok()) {
    throw new Error(`八字失败 ${baziRes.status()}: ${await baziRes.text()}`);
  }
  const baziData = await baziRes.json();
  const baziMeta = JSON.parse(baziData.resultMessage?.metadata ?? "{}");
  if (baziMeta.ui !== "bazi_result") {
    throw new Error(`bazi metadata.ui 错: ${baziMeta.ui}`);
  }

  // 6) meihua 数字测算
  const meihuaRes = await request.post("/api/divination/meihua", {
    data: {
      conversationId: convId,
      numbers: [3, 5, 7],
      userQuestion: "下个月项目能不能按时上线",
    },
  });
  if (!meihuaRes.ok()) {
    throw new Error(`梅花失败 ${meihuaRes.status()}: ${await meihuaRes.text()}`);
  }
  const meihuaData = await meihuaRes.json();
  const meihuaMeta = JSON.parse(meihuaData.resultMessage?.metadata ?? "{}");
  if (meihuaMeta.ui !== "meihua_result") {
    throw new Error(`meihua metadata.ui 错: ${meihuaMeta.ui}`);
  }
  if (!meihuaMeta.ben?.name || !meihuaMeta.bian?.name) {
    throw new Error("meihua metadata 缺 ben/bian 卦名");
  }

  // 7) 梅花外应回填
  const patchRes = await request.patch("/api/divination/meihua", {
    data: {
      messageId: meihuaData.resultMessage.id,
      waiying: "刚听见外面打雷",
    },
  });
  if (!patchRes.ok()) {
    throw new Error(`外应回填失败 ${patchRes.status()}: ${await patchRes.text()}`);
  }

  // 8) 删除会话
  const delRes = await request.delete(`/api/conversations/${convId}`);
  if (!delRes.ok()) {
    throw new Error(`删会话失败 ${delRes.status()}: ${await delRes.text()}`);
  }
});

test("敏感词 guard · hard 命中拒绝", async ({ request, page }) => {
  await page.goto("/");

  // 先建一个会话才能调 dream sub-action
  const chatRes = await request.post("/api/chat", {
    data: { conversationId: null, text: "你好" },
  });
  const meta = JSON.parse(
    (await chatRes.text()).match(/event: meta\s*\ndata: (\{[^}]+\})/)![1],
  );
  const convId = meta.conversationId;

  const res = await request.post("/api/divination/dream", {
    data: {
      conversationId: convId,
      mode: "fast",
      payload: { dreamText: "梦到自己买了毒品然后醒了" },
    },
  });
  if (res.ok()) {
    throw new Error(`hard 词应被 400 拦截，但返回了 ${res.status()}`);
  }
  if (res.status() !== 400) {
    throw new Error(`期望 400，实得 ${res.status()}`);
  }
});
