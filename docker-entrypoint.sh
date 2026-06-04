#!/bin/sh
set -e

API_DIR="/app/admin/api"
DEFAULTS="/app/defaults/api"
MODEL_DIR="/app/model"

# 确保 model 目录存在且可写
mkdir -p "$MODEL_DIR"
chmod -R a+rw "$MODEL_DIR" 2>/dev/null || true

if [ ! -f "$API_DIR/users.json" ]; then
    echo "[entrypoint] 初始化 users.json ..."
    cp "$DEFAULTS/users.json" "$API_DIR/users.json"
fi

echo "[entrypoint] 启动服务..."
exec node admin/dev-server.js
