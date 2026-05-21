/**
 * 均时差（Equation of Time）
 *
 * EoT(分钟) = 9.87×sin(2B) − 7.53×cos(B) − 1.5×sin(B)
 * B = 360°×(N−81)/365，N 为积日（1月1日 N=1）
 *
 * 来源：需求 §2.3 真太阳时校正公式
 */
function equationOfTime(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const N = Math.floor(diff / (24 * 60 * 60 * 1000));
  const B = (360 * (N - 81)) / 365;
  const B_rad = (B * Math.PI) / 180;
  return 9.87 * Math.sin(2 * B_rad) - 7.53 * Math.cos(B_rad) - 1.5 * Math.sin(B_rad);
}

/**
 * 真太阳时换算
 *
 * 真太阳时 = 北京时间 + 经度修正 + 均时差(EoT)
 * 经度修正(分钟) = (当地经度 - 120°) × 4
 * 均时差(EoT) = 9.87×sin(2B) − 7.53×cosB − 1.5×sinB
 */
export function toSolarTrueTime(beijingTime: Date, longitude: number): Date {
  const longitudeOffset = (longitude - 120) * 4;
  const eot = equationOfTime(beijingTime);
  const totalOffsetMinutes = longitudeOffset + eot;
  return new Date(beijingTime.getTime() + totalOffsetMinutes * 60_000);
}
