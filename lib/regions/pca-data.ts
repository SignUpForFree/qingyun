/**
 * 省/市/区 三级联动数据
 *
 * 数据源：china-division 包的 pca.json
 * 格式：{ "省": { "市": ["区1","区2",...] } }
 *
 * 注意：此模块在客户端使用，pca.json ~80KB gzip 后约 15KB，
 * 通过动态 import() 做按需加载，不进入首屏 bundle。
 */

import pcaRaw from "china-division/dist/pca.json";

/** 原始数据结构 */
type PcaData = Record<string, Record<string, string[]>>;

const PCA: PcaData = pcaRaw as unknown as PcaData;

/** 省份列表 */
export function getProvinces(): string[] {
  return Object.keys(PCA);
}

/** 某省下的城市列表 */
export function getCities(province: string): string[] {
  const cities = PCA[province];
  return cities ? Object.keys(cities) : [];
}

/** 某省某市下的区/县列表 */
export function getDistricts(province: string, city: string): string[] {
  return PCA[province]?.[city] ?? [];
}
