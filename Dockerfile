FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine

RUN apk add --no-cache su-exec && \
    addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY docker-entrypoint.sh docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

COPY admin/ admin/

RUN rm -f admin/api/users.json admin/api/rate_limit.json admin/api/model_list.json && \
    mkdir -p /app/defaults/api && \
    node -e "var b=require('bcryptjs');var h=b.hashSync('admin123',12);var d={users:{admin:{username:'admin',password_hash:h,role:'admin',created_at:new Date().toISOString(),failed_attempts:0,locked_until:null}},reset_tokens:{}};require('fs').writeFileSync('/app/defaults/api/users.json',JSON.stringify(d,null,4));" && \
    echo '{"models":[],"messages":[]}' > /app/defaults/api/model_list.json && \
    mkdir -p /app/model && \
    ln -sf /app/admin/api/model_list.json /app/model_list.json && \
    chown -R appuser:appuser /app

COPY add/ add/
COPY get/ get/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/admin/',function(r){process.exit(r.statusCode===200?0:1)})"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
