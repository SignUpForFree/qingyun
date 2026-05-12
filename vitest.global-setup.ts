/**
 * Vitest 全局 setup（main process，所有测试 worker 启动前跑一次）
 *
 * 作用：把测试隔离到独立的 dev.test.db，不再共用 dev/prod 的 dev.db。
 *
 * 历史问题（ARCHITECTURE.md §3.2-I）：
 *   测试很多用例 beforeEach 跑 db.delete(users / conversations / messages / ...)
 *   清表，跑 `pnpm test` 会把浏览器里的 dev session 全清空 —— dev 体验差，
 *   且 dev server 同时写 db 时偶发 SQLITE_BUSY race。
 *
 * 隔离后：
 *   - dev 用 dev.db（默认）
 *   - 测试用 dev.test.db（globalSetup 强制 set）
 *   - 两者互不干扰
 *
 * 注意：必须用 globalSetup 而非 setupFiles，因为 setupFiles 在测试文件 import 之后
 * 才跑，而 lib/db/client.ts 是模块单例，第一次 import 就读 process.env.DATABASE_URL
 * 锁住了。globalSetup 在 main process 启动时运行，set env 后才 fork test workers，
 * worker 进程继承到 set 后的 env。
 */
export default function setup(): void {
  // 不要覆盖用户 CI 显式设的 DATABASE_URL（比如 CI 用 :memory: 加速）
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./dev.test.db";
  }
  // NODE_ENV vitest 已自动设为 "test"，这里不重设，避免类型 readonly 报错
}
