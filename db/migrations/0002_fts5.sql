-- 全文搜索（spec §2.2）— FTS5 trigram 分词
-- M1.2 注入：drizzle push 后由 scripts/db-reset.ts 跑此 SQL
--
-- 分词器选择说明（与 spec §2.2 注解 "unicode61" 的偏离）：
--   * unicode61 不切分 CJK，会把 "今天抽签问感情" 当 1 个 token，
--     导致任何子串查询（如 "感情" / "抽签"）都拿不到 hit。
--   * trigram 是 SQLite 3.34+ 内置的 CJK 友好分词器，将文本切成 3-grams。
--     对中文场景常见的 3+ 字短语（"看感情" / "婚姻问题" / "明天运势"）能 MATCH。
--     代价：2 字查询（如 "感情"）仍不命中 — 这是 SQLite 内建分词器的共同
--     局限，避免引入 jieba 等 native 分词器；前端 UI 只允许 3+ 字搜索即可。
--   * 若 W3 后续要求支持 2 字 CJK 查询，需引入第三方分词器（spec §RFC）。

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
