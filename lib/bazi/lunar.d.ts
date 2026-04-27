declare module "lunar-javascript" {
  export interface EightCharYun {
    getDaYun(): DaYun[];
    getStartSolar(): Solar;
  }

  export interface DaYun {
    getStartAge(): number;
    getStartYear(): number;
    getEndAge(): number;
    getEndYear(): number;
    getGanZhi(): string;
  }

  export interface EightChar {
    getYearGan(): string;
    getYearZhi(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
    getYun(gender: 0 | 1): EightCharYun;
  }

  export interface Lunar {
    getEightChar(): EightChar;
    getSolar(): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    /** 例：丙午 */
    getYearInGanZhi(): string;
    /** 例：三 / 闰二 */
    getMonthInChinese(): string;
    /** 例：初七 / 廿五 */
    getDayInChinese(): string;
    /** 节气 → Solar map（如 {"立春": Solar(...), "雨水": Solar(...) ...}） */
    getJieQiTable(): Record<string, Solar>;
  }

  export interface Solar {
    getLunar(): Lunar;
    toYmdHms(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
  }

  export const Solar: {
    fromYmd(year: number, month: number, day: number): Solar;
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
  };

  export const Lunar: {
    fromYmd(year: number, month: number, day: number): Lunar;
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Lunar;
  };

  const lunarDefault: {
    Solar: typeof Solar;
    Lunar: typeof Lunar;
  };
  export default lunarDefault;
}
