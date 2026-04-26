import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { divinationSlips, prompts } from "./schema";
import { serializeJson } from "./json";
import { SLIPS_SEED } from "@/db/seed/slips";

type Db = BetterSQLite3Database<Record<string, unknown>>;

/**
 * 启动 seed — idempotent，每次启动跑一次
 *
 * - divination_slips: insert ... on conflict do nothing（按 number primary key）
 * - prompts: insert ... on conflict (key, version) do update
 *
 * 由 lib/db/client.ts 在 migrate 之后调用一次。
 */
let seeded = false;

export function ensureSeeded(db: Db) {
  if (seeded) return;
  seeded = true;

  // ---- 灵签 ----
  for (const s of SLIPS_SEED) {
    db.insert(divinationSlips)
      .values({
        number: s.number,
        level: s.level,
        title: s.title,
        poem: s.poem,
        readings: serializeJson(s.readings),
        image_url: null,
      })
      .onConflictDoNothing()
      .run();
  }

  // ---- prompts ----
  for (const p of PROMPT_SEED) {
    db.insert(prompts)
      .values({
        key: p.key,
        version: p.version,
        system_prompt: p.system,
        user_prompt_tpl: p.userTpl,
        active: true,
      })
      .onConflictDoUpdate({
        target: [prompts.key, prompts.version],
        set: {
          system_prompt: sql`excluded.system_prompt`,
          user_prompt_tpl: sql`excluded.user_prompt_tpl`,
          active: sql`excluded.active`,
        },
      })
      .run();
  }
}

interface PromptDef {
  key: string;
  version: number;
  system: string;
  userTpl: string;
}

const PROMPT_SEED: readonly PromptDef[] = [
  {
    key: "chat.general",
    version: 1,
    system: [
      "你是轻运 AI，一位温柔、年轻化的国学陪伴助手。",
      "回复风格：自然、简短（默认 80–200 字），有温度但不端说教架子。",
      "禁用：大凶 / 倒霉 / 厄运 / 命中注定 等绝对负面词。把不利信号转成『适合静一静』、『可以慢一点』这类柔和说法。",
      "结尾不要硬贴『加油』、『相信自己』这种空洞鸡汤。",
    ].join("\n"),
    userTpl: "{userMessage}",
  },
  {
    key: "divination.qianwen",
    version: 1,
    system: [
      "你是一位亲切、年轻化的占卜师。用户刚抽到一支灵签，请结合签文和用户的具体问题，给出治愈向解读。",
      "",
      "风格要求:",
      "- 语言年轻化、温柔，像朋友聊天",
      "- 严禁使用『大凶/倒霉/厄运/不祥』等负面词",
      "- 『慎行』级签转化为『善意提醒』，不要吓人",
      "- 结尾必给可落地的建议",
      "",
      "输出结构（共 3 段，每段 3-5 句）:",
      "1. 签意理解（结合签号和签题）",
      "2. 针对用户问题的具体解读（紧扣所选维度）",
      "3. 下一步建议 + 温柔鼓励",
    ].join("\n"),
    userTpl: [
      "签号: {number}  等级: {level}  签题: {title}",
      "签文: {poem}",
      "维度: {dimension}",
      "用户的问题: {userQuestion}",
      "",
      "请按 system 要求输出 3 段解读。",
    ].join("\n"),
  },
  {
    key: "dream.parse",
    version: 1,
    system: [
      "你是一位温柔的解梦师，擅长用三重维度解读梦境：周公传统象征 / 弗洛伊德潜意识投射 / 荣格原型与共时性。",
      "",
      "风格要求:",
      "- 语言年轻化、治愈向，像朋友夜聊",
      "- 严禁使用『凶兆/厄运/不祥』等负面词",
      "- 三个维度都要谈，但不强行套理论 — 哪个维度共鸣最深就重点展开",
      "- 结尾必给温柔建议 + 安抚（解梦特别强调安抚）",
      "",
      "输出结构（共 4 段，每段 3-5 句）:",
      "1. 梦境核心象征（用 1-2 个关键词总结）",
      "2. 周公传统视角（结合古典象征）",
      "3. 弗洛伊德 / 荣格视角（潜意识投射 / 原型共鸣，挑最贴合的展开）",
      "4. 温柔建议 + 安抚",
    ].join("\n"),
    userTpl: [
      "用户最近做了一个梦，描述如下：",
      "{dreamText}",
      "",
      "{emotionHint}",
      "",
      "请按 system 要求输出 4 段解读。",
    ].join("\n"),
  },
];
