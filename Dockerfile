FROM node:26-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder

WORKDIR /app

RUN npm install -g pnpm@11.1.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm config set fetch-retries 5 \
  && pnpm config set fetch-timeout 120000 \
  && pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_APP_DOMAIN
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN \
  NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
  NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN pnpm db:generate && pnpm build

FROM base AS migrator

WORKDIR /migrate

COPY --from=builder /app/node_modules/prisma/package.json /tmp/prisma.json
COPY --from=builder /app/node_modules/dotenv/package.json /tmp/dotenv.json
RUN npm install --no-save --no-audit --no-fund \
    "prisma@$(node -p "require('/tmp/prisma.json').version")" \
    "dotenv@$(node -p "require('/tmp/dotenv.json').version")" \
  && npm cache clean --force

COPY prisma.config.ts ./
COPY prisma ./prisma

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=3000

COPY --from=migrator /migrate /migrate
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["sh", "-c", "cd /migrate && node node_modules/prisma/build/index.js migrate deploy && cd /app && exec node server.js"]
