FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# ---------- build (single stage — avoids double npm ci) ----------
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ---------- production ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
RUN mkdir -p /data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
