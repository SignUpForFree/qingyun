/**
 * Cron 注册中心 — node-cron 实现版（2026-05-06）
 *
 * 用法：
 *   import { registerJob, startCron } from "@/lib/cron";
 *   registerJob({ name: "daily-fortune-push", expr: "30 0 * * *", task: async () => {...} });
 *   // instrumentation.ts → register() 调 startCron();
 *
 * 守门：
 *   - CRON_ENABLED=1 才会真正调度（默认 prod 开，dev 关）
 *   - 运行错误用 console.error 记录，不会让进程崩溃
 *   - 同一 job.name 同时只跑一份（concurrent guard）
 *
 * registerJob 顺序：daily-fortune-push / weekly-fortune / monthly-fortune（M5.2-M5.4）。
 */
import cron from "node-cron";

export interface RegisteredJob {
  name: string;
  /** cron 表达式 e.g. "30 0 * * *" */
  expr: string;
  task: () => Promise<void>;
}

const registry: RegisteredJob[] = [];
const tasks = new Map<string, ReturnType<typeof cron.schedule>>();
const running = new Set<string>();
let started = false;

export function registerJob(job: RegisteredJob): void {
  if (registry.some((j) => j.name === job.name)) {
    throw new Error(`cron job already registered: ${job.name}`);
  }
  if (!cron.validate(job.expr)) {
    throw new Error(`invalid cron expr for ${job.name}: ${job.expr}`);
  }
  registry.push(job);
}

export function listRegistered(): readonly RegisteredJob[] {
  return [...registry];
}

function shouldEnable(): boolean {
  const flag = process.env.CRON_ENABLED;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  // 缺省：生产开，开发关（避免本地长跑反复触发）
  return process.env.NODE_ENV === "production";
}

async function runWithGuard(job: RegisteredJob): Promise<void> {
  if (running.has(job.name)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[cron] skip overlap: ${job.name}`);
    }
    return;
  }
  running.add(job.name);
  const t0 = Date.now();
  try {
    await job.task();
    if (process.env.NODE_ENV !== "production") {
      console.info(`[cron] ${job.name} ok in ${Date.now() - t0}ms`);
    }
  } catch (err) {
    console.error(`[cron] ${job.name} failed`, err);
  } finally {
    running.delete(job.name);
  }
}

export function startCron(): void {
  if (started) return;
  started = true;
  if (registry.length === 0) return;
  if (!shouldEnable()) {
    console.info(
      `[cron] disabled (CRON_ENABLED=${process.env.CRON_ENABLED ?? "unset"}); ${registry.length} job(s) NOT scheduled`,
    );
    return;
  }
  const tz = process.env.CRON_TZ ?? "Asia/Shanghai";
  for (const job of registry) {
    const handle = cron.schedule(
      job.expr,
      () => {
        void runWithGuard(job);
      },
      { timezone: tz },
    );
    tasks.set(job.name, handle);
  }
  console.info(
    `[cron] scheduled ${registry.length} job(s) tz=${tz}: ${registry.map((j) => j.name).join(", ")}`,
  );
}

/** 优雅关闭（SIGTERM hook 用） */
export function stopCron(): void {
  for (const [, handle] of tasks) {
    try {
      handle.stop();
    } catch {
      /* 已 stop 不致命 */
    }
  }
  tasks.clear();
  started = false;
}

/** 测试用：清空 registry，重置 started 标志 */
export function resetCron(): void {
  stopCron();
  registry.length = 0;
  running.clear();
}
