#!/usr/bin/env bash
#
# 轮动快照 cron 触发脚本
#
# 用法（macOS / Linux crontab）：
#   1. 复制本脚本到合适位置或保留在仓库内
#   2. chmod +x scripts/rotation-cron.sh
#   3. 编辑 ~/.zshrc 或 ~/.bashrc，导出环境变量：
#        export ROTATION_CRON_TOKEN="<your-token-from-.env>"
#        export ROTATION_BASE_URL="http://localhost:3000"   # 或你的部署地址
#   4. crontab -e，加入下面 7 条（北京时间，假设服务器时区为 Asia/Shanghai）：
#
#      # 轮动快照 - 7 个交易日时点（仅 Mon-Fri）
#      CRON_TZ=Asia/Shanghai
#      15  9 * * 1-5  /path/to/repo/scripts/rotation-cron.sh PRE_OPEN >> /tmp/rotation-cron.log 2>&1
#      35  9 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 0930     >> /tmp/rotation-cron.log 2>&1
#      30 10 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1030     >> /tmp/rotation-cron.log 2>&1
#      25 11 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1100     >> /tmp/rotation-cron.log 2>&1
#      30 13 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1330     >> /tmp/rotation-cron.log 2>&1
#      30 14 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1430     >> /tmp/rotation-cron.log 2>&1
#       5 15 * * 1-5  /path/to/repo/scripts/rotation-cron.sh CLOSE    >> /tmp/rotation-cron.log 2>&1
#
# 注意：
#   - 如果系统不支持 CRON_TZ（macOS launchd 或老版本 cron），请把上面时间手动转成服务器时区
#   - 节假日跳过由 endpoint 端的 isTradingDay 自动处理
#   - $1 可省略，省略时 endpoint 用容错窗口自动判断 timeSlot

set -e

SLOT="${1:-}"
TOKEN="${ROTATION_CRON_TOKEN:?需要先 export ROTATION_CRON_TOKEN}"
BASE_URL="${ROTATION_BASE_URL:-http://localhost:3000}"

URL="${BASE_URL}/api/rotation/cron"
if [ -n "$SLOT" ]; then
  URL="${URL}?timeSlot=${SLOT}"
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[${TIMESTAMP}] Triggering ${URL}"

# --max-time 600: 单次快照最多 10 分钟（含换手率拉取）
# --fail-with-body: HTTP 4xx/5xx 时打印响应体并 exit 22
curl --silent --show-error --fail-with-body --max-time 600 \
  --request POST \
  --header "Authorization: Bearer ${TOKEN}" \
  "${URL}"

echo ""
echo "[${TIMESTAMP}] Done"
