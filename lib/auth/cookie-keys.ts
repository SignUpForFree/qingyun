/**
 * 共享的 cookie 常量 — middleware（edge runtime）/ session（node runtime）共用
 *
 * 单独抽这一个文件是为了让 middleware 不间接引入 lib/auth/session.ts 的依赖链
 * （session 引 ensure-placeholder-profile → db client → better-sqlite3 + node:path），
 * 否则 edge runtime 会报 "Failed to load external module node:path"。
 */
export const SESSION_COOKIE_KEY = "qy_uid";
