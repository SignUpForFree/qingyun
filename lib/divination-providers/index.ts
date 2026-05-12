/**
 * Divination 提供方统一出口
 *
 * 让路由 / fortune 计算只 import 这一个模块就能拿到 provider singleton
 * 和工厂函数，未来切第三方时只需修改 env，不必改业务代码。
 */
export {
  baziProvider,
  createBaziProvider,
  LocalBaziProvider,
  RemoteApiBaziProvider,
  type BaziProvider,
} from "./bazi";

export {
  meihuaProvider,
  createMeihuaProvider,
  LocalMeihuaProvider,
  RemoteApiMeihuaProvider,
  type MeihuaProvider,
} from "./meihua";
