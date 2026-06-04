#!/bin/sh
set -e

API_DIR="/app/admin/api"
DEFAULTS="/app/defaults/api"
MODEL_DIR="/app/model"

# 修复 model 目录权限（volume 挂载后可能由 root 拥有）
if [ -d "$MODEL_DIR" ]; then
    echo "[entrypoint] 修复 model 目录权限..."
    chown -R appuser:appuser "$MODEL_DIR" 2>/dev/null || true
    chmod -R u+rw "$MODEL_DIR" 2>/dev/null || true
fi

if [ ! -f "$API_DIR/users.json" ]; then
    echo "[entrypoint] 初始化 users.json ..."
    cp "$DEFAULTS/users.json" "$API_DIR/users.json"
    chown appuser:appuser "$API_DIR/users.json"
fi

echo "[entrypoint] 启动服务..."
exec su-exec appuser node admin/dev-server.js
