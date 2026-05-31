FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine

RUN addgroup -g 1001 appuser && adduser -u 1001 -G appuser -s /bin/sh -D appuser

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY . .

RUN mkdir -p /app/defaults/api && \
    cp /app/admin/api/users.json /app/defaults/api/users.json && \
    mv /app/model_list.json /app/admin/api/model_list.json && \
    cp /app/admin/api/model_list.json /app/defaults/api/model_list.json && \
    ln -s /app/admin/api/model_list.json /app/model_list.json && \
    chmod +x /app/docker-entrypoint.sh && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/admin/',function(r){process.exit(r.statusCode===200?0:1)})"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
