# syntax=docker/dockerfile:1.6
#
# 轻运 AI · Next.js 16 + SQLite Docker 镜像
# 多阶段构建：deps → builder → runner
#
# 构建：docker compose build
# 体积：~250 MB（standalone 输出 + alpine 基底）

# ─────────────────────────────────────────
# Stage 1: 装依赖（含 better-sqlite3 native 编译）
# ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# better-sqlite3 native 编译需要 python + build-base
RUN apk add --no-cache python3 make g++ libc6-compat

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ─────────────────────────────────────────
# Stage 2: 构建 Next.js standalone
# ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─────────────────────────────────────────
# Stage 3: 运行时（最小镜像）
# ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# better-sqlite3 运行时需要 libc6-compat（musl ↔ glibc 桥接）
RUN apk add --no-cache libc6-compat tini

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Shanghai

# 非 root 跑
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next standalone 输出已含 minimal node_modules（better-sqlite3 / bindings /
# lunar-javascript 都被 Next trace 进 .next/standalone/node_modules/.pnpm/）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# drizzle migrations 文件（启动时 lib/db/client.ts 会调用）
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations-sqlite ./db/migrations-sqlite

# DB 持久化目录（compose 会 volume mount 到这里）
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

# tini 处理 PID 1 信号转发，让 docker stop 能优雅退出
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
