#!/usr/bin/env bash
# 从 Supabase Cloud 项目生成 TypeScript 类型
#
# 用法：
#   SUPABASE_PROJECT_REF=<ref> ./scripts/gen-types.sh
#
# <ref> 在 Dashboard → Settings → General → Reference ID
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:?需要设置 SUPABASE_PROJECT_REF}"

pnpm dlx supabase@latest gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public > types/database.ts

echo "✅ types/database.ts 已从 Supabase Cloud 项目 $PROJECT_REF 生成"
