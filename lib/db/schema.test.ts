import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as s from "./schema";

/**
 * V2.0 schema completeness + cascade rule tests.
 *
 * Verifies the M1.1 14-table schema matches spec §2.2:
 *  - all 14 named exports exist
 *  - profiles has the new V2.0 fields (is_default, birth_calendar, bazi_pillars, current_address)
 *  - cascade rules per spec §2.3 #2:
 *      conversations.profile_id        → ON DELETE SET NULL  (preserve history)
 *      messages.profile_id_used        → ON DELETE SET NULL  (preserve history)
 *      fortunes_{daily,weekly,monthly} → ON DELETE CASCADE   (data meaningless without profile)
 */

const REQUIRED_TABLES = [
  "users",
  "wechatBind",
  "phoneBind",
  "profiles",
  "conversations",
  "messages",
  "fortunesDaily",
  "fortunesWeekly",
  "fortunesMonthly",
  "slips",
  "gua64",
  "cronRuns",
  "wechatTemplateLog",
  "wechatToken",
] as const;

describe("V2.0 schema", () => {
  it("has all 14 tables", () => {
    for (const k of REQUIRED_TABLES) {
      expect(s).toHaveProperty(k);
    }
  });

  it("profiles has is_default + birth_calendar + bazi_pillars + current_address", () => {
    const cfg = getTableConfig(s.profiles);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("is_default");
    expect(colNames).toContain("birth_calendar");
    expect(colNames).toContain("bazi_pillars");
    expect(colNames).toContain("current_address");
  });

  it("conversations.profile_id has ON DELETE SET NULL", () => {
    const cfg = getTableConfig(s.conversations);
    const fk = cfg.foreignKeys.find((f) =>
      f.reference().columns.some((c) => c.name === "profile_id"),
    );
    expect(fk, "conversations.profile_id FK exists").toBeDefined();
    expect(fk!.onDelete).toBe("set null");
  });

  it("messages.profile_id_used has ON DELETE SET NULL", () => {
    const cfg = getTableConfig(s.messages);
    const fk = cfg.foreignKeys.find((f) =>
      f.reference().columns.some((c) => c.name === "profile_id_used"),
    );
    expect(fk, "messages.profile_id_used FK exists").toBeDefined();
    expect(fk!.onDelete).toBe("set null");
  });

  it("fortunes_daily/weekly/monthly cascade on profile delete", () => {
    for (const tbl of [s.fortunesDaily, s.fortunesWeekly, s.fortunesMonthly]) {
      const cfg = getTableConfig(tbl);
      const fk = cfg.foreignKeys.find((f) =>
        f.reference().columns.some((c) => c.name === "profile_id"),
      );
      expect(fk, `${cfg.name}.profile_id FK exists`).toBeDefined();
      expect(fk!.onDelete).toBe("cascade");
    }
  });

  it("conversations.user_id and messages.conversation_id cascade", () => {
    const convCfg = getTableConfig(s.conversations);
    const userFk = convCfg.foreignKeys.find((f) =>
      f.reference().columns.some((c) => c.name === "user_id"),
    );
    expect(userFk!.onDelete).toBe("cascade");

    const msgCfg = getTableConfig(s.messages);
    const convFk = msgCfg.foreignKeys.find((f) =>
      f.reference().columns.some((c) => c.name === "conversation_id"),
    );
    expect(convFk!.onDelete).toBe("cascade");
  });

  it("wechatBind and phoneBind cascade on user delete", () => {
    for (const tbl of [s.wechatBind, s.phoneBind]) {
      const cfg = getTableConfig(tbl);
      const fk = cfg.foreignKeys.find((f) =>
        f.reference().columns.some((c) => c.name === "user_id"),
      );
      expect(fk, `${cfg.name}.user_id FK exists`).toBeDefined();
      expect(fk!.onDelete).toBe("cascade");
    }
  });

  it("wechatTemplateLog cascades on user delete", () => {
    const cfg = getTableConfig(s.wechatTemplateLog);
    const fk = cfg.foreignKeys.find((f) =>
      f.reference().columns.some((c) => c.name === "user_id"),
    );
    expect(fk!.onDelete).toBe("cascade");
  });

  it("slips PK is number", () => {
    const cfg = getTableConfig(s.slips);
    const pk = cfg.columns.find((c) => c.name === "number");
    expect(pk?.primary).toBe(true);
  });

  it("gua64 PK is number", () => {
    const cfg = getTableConfig(s.gua64);
    const pk = cfg.columns.find((c) => c.name === "number");
    expect(pk?.primary).toBe(true);
  });

  it("wechatToken PK is type", () => {
    const cfg = getTableConfig(s.wechatToken);
    const pk = cfg.columns.find((c) => c.name === "type");
    expect(pk?.primary).toBe(true);
  });

  it("fortunes_daily uses composite PK (profile_id, date)", () => {
    const cfg = getTableConfig(s.fortunesDaily);
    expect(cfg.primaryKeys.length).toBe(1);
    const pkCols = cfg.primaryKeys[0]!.columns.map((c) => c.name);
    expect(pkCols).toEqual(expect.arrayContaining(["profile_id", "date"]));
  });
});
