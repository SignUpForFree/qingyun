import { test } from "@playwright/test";

/**
 * 全 divination API 烟测
 *
 * 用 same-context 跑：先 POST /api/profile 建档（让 bazi 路由有命盘）→
 * 串接 5 条占卜 API。每个步骤都做最低限度 schema 校验。
 *
 * 注意：所有路由内部走 fallback（无 DEEPSEEK_API_KEY），AI 文本不影响断言；
 * 只校验路由能跑通 + 关键字段存在
 */

test("API 烟测 · dream / bazi / meihua / 删会话 全链路", async ({ request, page }) => {
  // 拿 anon cookie
  await page.goto("/");

  // 1) 建档（bazi 需要）
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
      region: { province: "上海", city: "上海", longitude: 121.4737, latitude: 31.2304 },
    },
  });
  if (!profileRes.ok()) {
    throw new Error(`建档失败 ${profileRes.status()}: ${await profileRes.text()}`);
  }

  // 2) 解梦
  const dreamRes = await request.post("/api/divination/dream", {
    data: {
      dreamText: "梦见自己在云海上飞，下面有人在喊我的名字，醒来心里很平静",
      emotion: "平静",
    },
  });
  if (!dreamRes.ok()) {
    throw new Error(`解梦失败 ${dreamRes.status()}: ${await dreamRes.text()}`);
  }
  const dreamData = await dreamRes.json();
  if (typeof dreamData.assistantMessage?.content !== "string") {
    throw new Error("dream 响应缺 assistantMessage.content");
  }
  const dreamConvId = dreamData.conversationId;
  if (!dreamConvId) throw new Error("dream 响应缺 conversationId");

  // 3) 八字解读
  const baziRes = await request.post("/api/divination/bazi", {
    data: { focus: "事业", userQuestion: "最近换工作合不合适" },
  });
  if (!baziRes.ok()) {
    throw new Error(`八字失败 ${baziRes.status()}: ${await baziRes.text()}`);
  }
  const baziData = await baziRes.json();
  if (typeof baziData.assistantMessage?.content !== "string") {
    throw new Error("bazi 响应缺 assistantMessage.content");
  }

  // 4) 梅花起卦（数字起卦，结果可重复）
  const meihuaRes = await request.post("/api/divination/meihua", {
    data: { method: "number", numbers: [3, 5], userQuestion: "下个月项目能不能按时上线" },
  });
  if (!meihuaRes.ok()) {
    throw new Error(`梅花失败 ${meihuaRes.status()}: ${await meihuaRes.text()}`);
  }
  const meihuaData = await meihuaRes.json();
  if (typeof meihuaData.assistantMessage?.metadata !== "string") {
    throw new Error("meihua 响应缺 assistantMessage.metadata");
  }
  const meihuaMeta = JSON.parse(meihuaData.assistantMessage.metadata);
  if (meihuaMeta.ui !== "meihua_result") {
    throw new Error(`metadata.ui 错误: ${meihuaMeta.ui}`);
  }
  if (!meihuaMeta.ben?.name || !meihuaMeta.bian?.name) {
    throw new Error("metadata 缺 ben/bian 卦名");
  }

  // 5) 梅花外应回填
  const patchRes = await request.patch("/api/divination/meihua", {
    data: { messageId: meihuaData.assistantMessage.id, waiying: "刚听见外面打雷" },
  });
  if (!patchRes.ok()) {
    throw new Error(`外应回填失败 ${patchRes.status()}: ${await patchRes.text()}`);
  }

  // 6) 删除会话（用 dream 那条）
  const delRes = await request.delete(`/api/conversations/${dreamConvId}`);
  if (!delRes.ok()) {
    throw new Error(`删会话失败 ${delRes.status()}: ${await delRes.text()}`);
  }
});

test("敏感词 guard · hard 命中拒绝", async ({ request, page }) => {
  await page.goto("/");

  const res = await request.post("/api/divination/dream", {
    data: { dreamText: "梦到自己买了毒品然后醒了" },
  });
  if (res.ok()) {
    throw new Error(`hard 词应被 400 拦截，但返回了 ${res.status()}`);
  }
  if (res.status() !== 400) {
    throw new Error(`期望 400，实得 ${res.status()}`);
  }
  const body = await res.json();
  if (body.safetyLevel !== "hard") {
    throw new Error(`期望 safetyLevel='hard'，实得 ${body.safetyLevel}`);
  }
});
