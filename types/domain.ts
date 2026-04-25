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

export interface BuildChartInput {
  birthTime: Date;
  longitude: number;
  latitude: number;
  gender: Gender;
  calendarType: CalendarType;
}
