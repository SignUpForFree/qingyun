#!/bin/bash
# 验证 qingyun.{domain}.com 的 A 记录是否解析到生产 IP（43.129.186.82）
# 用法: bash scripts/check-dns.sh qingyun.example.com
#
# 退出码：0 = 解析正确；非 0 = 解析未生效或解析到其他 IP

set -e

DOMAIN="${1:?usage: $0 <domain>}"
EXPECTED_IP="${EXPECTED_IP:-43.129.186.82}"

A_RECORD=$(dig +short A "$DOMAIN" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)

if [ -z "$A_RECORD" ]; then
  echo "FAIL: no A record for $DOMAIN" >&2
  exit 1
fi

if [ "$A_RECORD" != "$EXPECTED_IP" ]; then
  echo "FAIL: A record = $A_RECORD, expected $EXPECTED_IP" >&2
  exit 2
fi

echo "OK: $DOMAIN -> $A_RECORD"
