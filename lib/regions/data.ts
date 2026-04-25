/**
 * 省 / 市 经纬度数据（MVP 简化版）
 *
 * 覆盖：4 个直辖市 + 27 个省会 + 几个常见非省会主要城市
 * 字段含义：经纬度采用市政府所在地的坐标，精度 4 位，用于八字真太阳时换算
 *
 * 后续升级路径：
 *   - V1.0.5 / V1.1 接入完整省/市/区数据（如 [chinese-cities](https://github.com/modood/Administrative-divisions-of-China)）
 *   - 当前 MVP 区一级让用户文本输入即可（lib/bazi/solar-time.ts 已经按经度算偏移，区误差很小可接受）
 */

export interface City {
  name: string;
  lng: number;
  lat: number;
}

export interface Province {
  name: string;
  cities: City[];
}

export const REGIONS: readonly Province[] = [
  {
    name: "北京",
    cities: [{ name: "北京", lng: 116.4074, lat: 39.9042 }],
  },
  {
    name: "上海",
    cities: [{ name: "上海", lng: 121.4737, lat: 31.2304 }],
  },
  {
    name: "天津",
    cities: [{ name: "天津", lng: 117.2010, lat: 39.0842 }],
  },
  {
    name: "重庆",
    cities: [{ name: "重庆", lng: 106.5516, lat: 29.5630 }],
  },
  {
    name: "广东",
    cities: [
      { name: "广州", lng: 113.2644, lat: 23.1291 },
      { name: "深圳", lng: 114.0579, lat: 22.5431 },
      { name: "珠海", lng: 113.5767, lat: 22.2710 },
      { name: "佛山", lng: 113.1216, lat: 23.0218 },
      { name: "东莞", lng: 113.7518, lat: 23.0207 },
    ],
  },
  {
    name: "江苏",
    cities: [
      { name: "南京", lng: 118.7969, lat: 32.0603 },
      { name: "苏州", lng: 120.5853, lat: 31.2989 },
      { name: "无锡", lng: 120.3019, lat: 31.5747 },
      { name: "南通", lng: 120.8943, lat: 31.9802 },
    ],
  },
  {
    name: "浙江",
    cities: [
      { name: "杭州", lng: 120.1551, lat: 30.2741 },
      { name: "宁波", lng: 121.5440, lat: 29.8683 },
      { name: "温州", lng: 120.6720, lat: 28.0009 },
    ],
  },
  {
    name: "山东",
    cities: [
      { name: "济南", lng: 117.0009, lat: 36.6758 },
      { name: "青岛", lng: 120.3826, lat: 36.0671 },
    ],
  },
  {
    name: "河南",
    cities: [
      { name: "郑州", lng: 113.6253, lat: 34.7466 },
      { name: "洛阳", lng: 112.4540, lat: 34.6197 },
    ],
  },
  {
    name: "河北",
    cities: [
      { name: "石家庄", lng: 114.5149, lat: 38.0428 },
      { name: "唐山", lng: 118.1755, lat: 39.6356 },
    ],
  },
  {
    name: "山西",
    cities: [{ name: "太原", lng: 112.5328, lat: 37.8706 }],
  },
  {
    name: "辽宁",
    cities: [
      { name: "沈阳", lng: 123.4315, lat: 41.8057 },
      { name: "大连", lng: 121.6147, lat: 38.9140 },
    ],
  },
  {
    name: "吉林",
    cities: [{ name: "长春", lng: 125.3245, lat: 43.8868 }],
  },
  {
    name: "黑龙江",
    cities: [{ name: "哈尔滨", lng: 126.5358, lat: 45.8023 }],
  },
  {
    name: "陕西",
    cities: [{ name: "西安", lng: 108.9398, lat: 34.3416 }],
  },
  {
    name: "甘肃",
    cities: [{ name: "兰州", lng: 103.8235, lat: 36.0581 }],
  },
  {
    name: "青海",
    cities: [{ name: "西宁", lng: 101.7782, lat: 36.6171 }],
  },
  {
    name: "宁夏",
    cities: [{ name: "银川", lng: 106.2309, lat: 38.4872 }],
  },
  {
    name: "新疆",
    cities: [
      { name: "乌鲁木齐", lng: 87.6177, lat: 43.7928 },
      { name: "喀什", lng: 75.9897, lat: 39.4677 },
    ],
  },
  {
    name: "西藏",
    cities: [{ name: "拉萨", lng: 91.1322, lat: 29.6604 }],
  },
  {
    name: "云南",
    cities: [{ name: "昆明", lng: 102.8329, lat: 24.8801 }],
  },
  {
    name: "贵州",
    cities: [{ name: "贵阳", lng: 106.7135, lat: 26.5783 }],
  },
  {
    name: "四川",
    cities: [
      { name: "成都", lng: 104.0665, lat: 30.5728 },
      { name: "绵阳", lng: 104.6794, lat: 31.4677 },
    ],
  },
  {
    name: "湖北",
    cities: [{ name: "武汉", lng: 114.3055, lat: 30.5928 }],
  },
  {
    name: "湖南",
    cities: [{ name: "长沙", lng: 112.9388, lat: 28.2278 }],
  },
  {
    name: "江西",
    cities: [{ name: "南昌", lng: 115.8581, lat: 28.6829 }],
  },
  {
    name: "福建",
    cities: [
      { name: "福州", lng: 119.2965, lat: 26.0745 },
      { name: "厦门", lng: 118.0894, lat: 24.4798 },
    ],
  },
  {
    name: "安徽",
    cities: [{ name: "合肥", lng: 117.2272, lat: 31.8206 }],
  },
  {
    name: "广西",
    cities: [
      { name: "南宁", lng: 108.3669, lat: 22.8170 },
      { name: "桂林", lng: 110.2994, lat: 25.2736 },
    ],
  },
  {
    name: "海南",
    cities: [{ name: "海口", lng: 110.3312, lat: 20.0311 }],
  },
  {
    name: "内蒙古",
    cities: [{ name: "呼和浩特", lng: 111.7519, lat: 40.8414 }],
  },
  {
    name: "香港",
    cities: [{ name: "香港", lng: 114.1095, lat: 22.3964 }],
  },
  {
    name: "澳门",
    cities: [{ name: "澳门", lng: 113.5439, lat: 22.1987 }],
  },
  {
    name: "台湾",
    cities: [
      { name: "台北", lng: 121.5654, lat: 25.0330 },
      { name: "高雄", lng: 120.3014, lat: 22.6273 },
    ],
  },
] as const;

export function findProvince(name: string): Province | undefined {
  return REGIONS.find((p) => p.name === name);
}

export function findCity(provinceName: string, cityName: string): City | undefined {
  return findProvince(provinceName)?.cities.find((c) => c.name === cityName);
}
