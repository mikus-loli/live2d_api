FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

# 构建前台
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build && rm -rf node_modules

FROM node:22-alpine

WORKDIR /app

# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

COPY admin/ admin/

RUN rm -f admin/api/users.json admin/api/rate_limit.json && \
    mkdir -p /app/defaults/api && \
    mkdir -p /app/model && \
    chown -R appuser:appgroup /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/get/?name=_healthcheck_',function(r){process.exit(r.statusCode<500?0:1)}).on('error',function(){process.exit(1)})"

USER appuser

ENTRYPOINT ["/app/docker-entrypoint.sh"]
