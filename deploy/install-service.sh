#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="moneyback"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="$USER_UNIT_DIR/${SERVICE_NAME}.service"

echo "==> 构建项目..."
cd "$PROJECT_DIR"
npm run build

echo "==> 安装 systemd 用户服务..."
mkdir -p "$USER_UNIT_DIR"
sed -e "s|%PROJECT_DIR%|$PROJECT_DIR|g" -e "s|%HOME%|$HOME|g" \
  "$PROJECT_DIR/deploy/moneyback.service" > "$UNIT_FILE"
echo "    已写入 $UNIT_FILE"

if systemctl --user daemon-reload 2>/dev/null; then
  systemctl --user enable "$SERVICE_NAME"
  systemctl --user restart "$SERVICE_NAME"

  if command -v loginctl >/dev/null 2>&1; then
    loginctl enable-linger "$USER" 2>/dev/null || true
  fi

  echo ""
  echo "安装完成！服务已启动并设为开机自启。"
  echo "  访问地址: http://localhost:3456"
  systemctl --user status "$SERVICE_NAME" --no-pager || true
else
  echo ""
  echo "systemd 当前不可用（WSL 需要重启后才能启用）。"
  echo "服务文件已安装，请执行以下步骤："
  echo ""
  echo "  1. 在 Windows PowerShell 中重启 WSL："
  echo "       wsl --shutdown"
  echo "     然后重新打开 WSL 终端"
  echo ""
  echo "  2. 启动并启用服务："
  echo "       systemctl --user daemon-reload"
  echo "       systemctl --user enable --now $SERVICE_NAME"
  echo "       loginctl enable-linger \$USER"
  echo ""
  echo "  访问地址: http://localhost:3456"
fi

echo ""
echo "常用命令:"
echo "  查看状态: systemctl --user status $SERVICE_NAME"
echo "  查看日志: journalctl --user -u $SERVICE_NAME -f"
echo "  停止服务: systemctl --user stop $SERVICE_NAME"
echo "  重启服务: systemctl --user restart $SERVICE_NAME"
echo "  取消自启: systemctl --user disable $SERVICE_NAME"
