#!/bin/sh
set -e

API_DIR="/app/admin/api"
DEFAULTS="/app/defaults/api"
MODEL_DIR="/app/model"

# 确保 model 目录存在且可写
mkdir -p "$MODEL_DIR"

if [ ! -f "$API_DIR/users.json" ]; then
    echo "[entrypoint] 初始化 users.json ..."
    # 在运行时生成密码哈希，避免构建期固化弱密码
    ADMIN_PASS="${ADMIN_PASSWORD:-}"
    if [ -z "$ADMIN_PASS" ]; then
        # 生成随机密码并输出到日志
        ADMIN_PASS=$(head -c 16 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
        echo "[entrypoint] 警告：未设置 ADMIN_PASSWORD，已生成随机密码。请通过环境变量 ADMIN_PASSWORD 设置。"
    fi
    node -e "var b=require('bcryptjs');var h=b.hashSync(process.argv[1],12);var d={users:{admin:{username:'admin',password_hash:h,role:'admin',created_at:new Date().toISOString(),failed_attempts:0,locked_until:null}},reset_tokens:{}};require('fs').writeFileSync('$API_DIR/users.json',JSON.stringify(d,null,4));" "$ADMIN_PASS"
fi

echo "[entrypoint] 启动服务..."
exec node admin/dev-server.js
