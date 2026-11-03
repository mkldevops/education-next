# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl

FROM base AS deps

WORKDIR /app

RUN npm install -g pnpm@11.1.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm config set fetch-retries 5 \
  && pnpm config set fetch-timeout 120000 \
  && pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
  pnpm db:generate && pnpm build

FROM base AS migrator

WORKDIR /migrate

COPY --from=builder /app/node_modules/prisma/package.json /tmp/prisma.json
COPY --from=builder /app/node_modules/dotenv/package.json /tmp/dotenv.json
RUN npm install --no-save --no-audit --no-fund --omit=dev \
    "prisma@$(node -p "require('/tmp/prisma.json').version")" \
    "dotenv@$(node -p "require('/tmp/dotenv.json').version")" \
  && npm cache clean --force \
  && cd node_modules \
  && rm -rf @electric-sql @types @visx elkjs lodash react react-dom /root/.npm /tmp/*.json

COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production \
  HOSTNAME=:: \
  PORT=3000

RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=migrator --chown=nextjs:nodejs /migrate /migrate
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "cd /migrate && node node_modules/prisma/build/index.js migrate deploy && cd /app && export HOSTNAME=:: && exec node server.js"]
