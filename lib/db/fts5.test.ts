import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDb } from "./client";
import { messages, conversations, users } from "./schema";

/**
 * messages_fts 触发器测试 — 验证 INSERT / DELETE / UPDATE 三个 trigger 同步
 *
 * 分词器：trigram（spec §2.2 / 0002_fts5.sql 头部注释说明为何不用 unicode61）
 *   trigram 把文本切成 3-grams，所以测试 query 都用 ≥3 字短语
 *   ("抽签问" 等)；2-字 CJK 查询是 SQLite 内置分词器的共同盲区。
 */

describe("messages_fts", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(users);
    const now = new Date().toISOString();
    await db.insert(users).values({ id: "u1", created_at: now, updated_at: now });
    await db.insert(conversations).values({
      id: "c1",
      user_id: "u1",
      title: "t",
      created_at: now,
    });
    await db.insert(messages).values({
      id: "m1",
      conversation_id: "c1",
      role: "user",
      content: "今天抽签问感情",
      created_at: now,
    });
  });

  it("inserts into messages_fts via trigger", () => {
    const db = getDb();
    const r = db.$client
      .prepare("SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?")
      .all("抽签问") as Array<{ rowid: number }>;
    expect(r.length).toBe(1);
  });

  it("delete removes from fts", () => {
    const db = getDb();
    db.$client.prepare("DELETE FROM messages WHERE id = 'm1'").run();
    const r = db.$client
      .prepare("SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?")
      .all("抽签问") as Array<{ rowid: number }>;
    expect(r.length).toBe(0);
  });

  it("update propagates to fts", () => {
    const db = getDb();
    db.$client.prepare("UPDATE messages SET content = ? WHERE id = 'm1'").run("替换为新词条");
    const oldHits = db.$client
      .prepare("SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?")
      .all("抽签问") as Array<{ rowid: number }>;
    expect(oldHits.length).toBe(0);
    const newHits = db.$client
      .prepare("SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?")
      .all("新词条") as Array<{ rowid: number }>;
    expect(newHits.length).toBe(1);
  });
});
