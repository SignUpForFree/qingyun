/**
 * Cron 注册中心（M0.4 stub）
 *
 * M0 仅 stub，无任务注册：startCron() no-op。
 * M5.1 接入 node-cron 实际调度 + setImmediate 拆批 + 限并发 5（防御 #16）。
 *
 * 用法：
 *   import { registerJob, startCron } from "@/lib/cron";
 *   registerJob({ name: "daily-fortune-push", expr: "30 0 * * *", task: async () => {...} });
 *   instrumentation.ts → register() 调 startCron();
 *
 * registerJob 顺序：M5.2 daily-fortune-push / M5.3 weekly-fortune / M5.4 monthly-fortune。
 */

export interface RegisteredJob {
  name: string;
  expr: string; // cron 表达式 e.g. "30 0 * * *"
  task: () => Promise<void>;
}

const registry: RegisteredJob[] = [];
let started = false;

/**
 * 注册一个 cron 任务。
 *
 * 重名 throw，避免静默覆盖。
 */
export function registerJob(job: RegisteredJob): void {
  if (registry.some((j) => j.name === job.name)) {
    throw new Error(`cron job already registered: ${job.name}`);
  }
  registry.push(job);
}

/**
 * 列出所有已注册任务（测试用）。
 */
export function listRegistered(): readonly RegisteredJob[] {
  return [...registry];
}

/**
 * 启动调度。M5.1 替换为 node-cron + processBatched。
 *
 * M0 仅 console.info 占位；registry 空时完全 no-op。
 */
export function startCron(): void {
  if (started) return;
  started = true;
  if (registry.length === 0) return;
  // M5.1 替换：
  //   import cron from "node-cron";
  //   for (const job of registry) {
  //     cron.schedule(job.expr, () => { void logCronRun(job.name, job.task); },
  //       { timezone: process.env.CRON_TZ ?? "Asia/Shanghai" });
  //   }
  // eslint-disable-next-line no-console
  console.info(`[cron] M0 stub — ${registry.length} job(s) registered, scheduling deferred to M5`);
  for (const job of registry) {
    // eslint-disable-next-line no-console
    console.info(`  - ${job.name} @ ${job.expr}`);
  }
}

/** 测试用：清空 registry，重置 started 标志 */
export function resetCron(): void {
  registry.length = 0;
  started = false;
}
