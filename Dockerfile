FROM node:22-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.1.2

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

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]
