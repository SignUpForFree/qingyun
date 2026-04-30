import type { Stem, Branch, Wuxing, TenGod } from "@/lib/bazi/stems-branches";

export interface BaziPillar {
  gan: Stem;
  zhi: Branch;
}

export interface BaziPillars {
  year: BaziPillar;
  month: BaziPillar;
  day: BaziPillar;
  hour: BaziPillar;
}

export interface LuckPillar {
  age: number;
  gan: Stem;
  zhi: Branch;
}

export interface BaziTenGods {
  year: TenGod;
  month: TenGod;
  hour: TenGod;
}

export interface BaziComputed {
  pillars: BaziPillars;
  fiveElements: Record<Wuxing, number>;
  dayMaster: Stem;
  tenGods: BaziTenGods;
  luckPillars: LuckPillar[];
  solarTrueTime: string;
}

export type Gender = "male" | "female";
export type CalendarType = "solar" | "lunar";

/** 用户消息意图（spec §5.1 五分类） */
export type Intent = "divination" | "dream" | "bazi" | "meihua" | "chat";

export interface BuildChartInput {
  birthTime: Date;
  longitude: number;
  latitude: number;
  gender: Gender;
  calendarType: CalendarType;
  /** 农历闰月：仅 calendarType=lunar 时有意义；true → 转 solar 时把月份取负传给 lunar.js */
  isLeapMonth?: boolean;
}
