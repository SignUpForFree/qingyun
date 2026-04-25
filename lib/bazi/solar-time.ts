/**
 * 真太阳时换算
 *
 * 偏差分钟 = (真实经度 - 标准经度 120°) × 4 分钟/度
 *
 * 注：均时差（地球公转椭圆轨道导致的天文校正）忽略不计，
 * 全年最大约 ±16 分钟，对八字时辰判定影响有限（时辰跨度 2 小时）。
 * 若未来需要更精确的真太阳时，应额外引入均时差表。
 */
export function toSolarTrueTime(beijingTime: Date, longitude: number): Date {
  const offsetMinutes = (longitude - 120) * 4;
  return new Date(beijingTime.getTime() + offsetMinutes * 60_000);
}
