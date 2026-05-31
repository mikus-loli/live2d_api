FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine

RUN addgroup -g 1001 appuser && adduser -u 1001 -G appuser -s /bin/sh -D appuser

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY . .

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/admin/',function(r){process.exit(r.statusCode===200?0:1)})"

CMD ["node", "admin/dev-server.js"]
