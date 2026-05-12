import { describe, it, expect, afterEach } from "vitest";
import {
  createBaziProvider,
  LocalBaziProvider,
  RemoteApiBaziProvider,
} from "./bazi";
import {
  createMeihuaProvider,
  LocalMeihuaProvider,
  RemoteApiMeihuaProvider,
} from "./meihua";

describe("BaziProvider factory", () => {
  afterEach(() => {
    delete process.env.BAZI_PROVIDER;
  });

  it("default returns LocalBaziProvider", () => {
    expect(createBaziProvider()).toBeInstanceOf(LocalBaziProvider);
  });

  it("kind=api returns RemoteApiBaziProvider", () => {
    expect(createBaziProvider({ kind: "api" })).toBeInstanceOf(
      RemoteApiBaziProvider,
    );
  });

  it("env BAZI_PROVIDER=api selects api", () => {
    process.env.BAZI_PROVIDER = "api";
    expect(createBaziProvider()).toBeInstanceOf(RemoteApiBaziProvider);
  });

  it("RemoteApi placeholder throws on call", async () => {
    const p = new RemoteApiBaziProvider();
    await expect(
      p.buildChart({
        birthTime: new Date("1995-03-22T09:00:00+08:00"),
        longitude: 121.47,
        latitude: 31.23,
        gender: "female",
        calendarType: "solar",
      }),
    ).rejects.toThrow(/not yet implemented/);
  });

  it("LocalBaziProvider returns chart with pillars + dayMaster", async () => {
    const p = new LocalBaziProvider();
    const chart = await p.buildChart({
      birthTime: new Date("1995-03-22T09:00:00+08:00"),
      longitude: 121.47,
      latitude: 31.23,
      gender: "female",
      calendarType: "solar",
    });
    expect(chart.pillars).toBeDefined();
    expect(chart.dayMaster).toBeDefined();
    expect(chart.fiveElements).toBeDefined();
  });
});

describe("MeihuaProvider factory", () => {
  afterEach(() => {
    delete process.env.MEIHUA_PROVIDER;
  });

  it("default returns LocalMeihuaProvider", () => {
    expect(createMeihuaProvider()).toBeInstanceOf(LocalMeihuaProvider);
  });

  it("RemoteApi placeholder throws on call", async () => {
    const p = new RemoteApiMeihuaProvider();
    await expect(p.cast({ numbers: [1, 2, 3], profile: null })).rejects.toThrow(
      /not yet implemented/,
    );
  });

  it("LocalMeihuaProvider returns ben/hu/bian", async () => {
    const p = new LocalMeihuaProvider();
    const r = await p.cast({ numbers: [123, 456, 789], profile: null });
    expect(r.ben).toBeDefined();
    expect(r.hu).toBeDefined();
    expect(r.bian).toBeDefined();
  });
});
