#!/bin/sh
set -e

API_DIR="/app/admin/api"
DEFAULTS="/app/defaults/api"

if [ ! -f "$API_DIR/users.json" ]; then
    echo "[entrypoint] 初始化 users.json ..."
    cp "$DEFAULTS/users.json" "$API_DIR/users.json"
    chown appuser:appuser "$API_DIR/users.json"
fi

if [ ! -f "$API_DIR/model_list.json" ]; then
    echo "[entrypoint] 初始化 model_list.json ..."
    cp "$DEFAULTS/model_list.json" "$API_DIR/model_list.json"
    chown appuser:appuser "$API_DIR/model_list.json"
fi

echo "[entrypoint] 启动服务..."
exec su-exec appuser node admin/dev-server.js
