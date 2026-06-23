#!/usr/bin/env bash
# 供 Windows 开机时通过 WSL 拉起 MoneyBack 服务。
# 任务计划示例：
#   wsl.exe -d Ubuntu -u edda -- bash /home/edda/code/MoneyBack/scripts/start-daemon.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3456}"
SERVICE_NAME="moneyback"
PID_FILE="${MONEYBACK_PID_FILE:-$PROJECT_DIR/.moneyback.pid}"
LOG_DIR="${MONEYBACK_LOG_DIR:-$PROJECT_DIR/logs}"
LOG_FILE="$LOG_DIR/moneyback.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

is_port_listening() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q .
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1
    return
  fi
  return 1
}

is_daemon_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(<"$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$PID_FILE"
  fi
  is_port_listening
}

start_with_systemd() {
  if ! systemctl --user start "$SERVICE_NAME" 2>/dev/null; then
    return 1
  fi
  log "已通过 systemd 启动 $SERVICE_NAME"
  return 0
}

start_with_nohup() {
  if is_daemon_running; then
    log "MoneyBack 已在运行 (端口 $PORT)，跳过启动"
    return 0
  fi

  if [[ ! -f "$PROJECT_DIR/server/dist/index.js" ]] || [[ ! -f "$PROJECT_DIR/client/dist/index.html" ]]; then
    log "缺少构建产物，正在执行 npm run build..."
    cd "$PROJECT_DIR"
    /usr/bin/npm run build >> "$LOG_FILE" 2>&1
  fi

  cd "$PROJECT_DIR"
  nohup /usr/bin/npm start >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  log "MoneyBack 已后台启动，PID $(<"$PID_FILE")，http://localhost:$PORT"
}

mkdir -p "$LOG_DIR"

if start_with_systemd; then
  exit 0
fi

start_with_nohup
