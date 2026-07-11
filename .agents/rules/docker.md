---
paths:
  - "Dockerfile"
  - ".dockerignore"
  - "compose*.yaml"
  - "package.json"
  - ".github/workflows/**"
---

# Docker and Runtime Rules

Scope: Dockerfile, .dockerignore, compose*.yaml, package.json, .github/workflows/**

## Proactive Behavior

Keep the application runtime, CI runtime, package-manager version, and deployment documentation
aligned. Never hard-code production secrets in Docker or Compose configuration.

## Current Topology

`compose.yaml` starts PostgreSQL 18 and Mailpit only; it does not run the Next.js application. The
Docker image generates Prisma Client and runs `pnpm build`, then starts with `pnpm start`. It does not
run `prisma migrate deploy`.

Docker and CI currently pin Node.js 22 while the repository pins `pnpm@11.1.2`. A Node.js 24 upgrade
must update `Dockerfile`, `.github/workflows/ci.yaml`, and developer guidance together.

## Compose Safety

Use the standard `compose.yaml` name, named volumes for persistent data, health checks for dependent
services, and read-only mounts for init scripts. PostgreSQL init scripts run only on a fresh volume;
never suggest deleting a volume without warning that it destroys local data.

Keep `.env` out of image layers and version control. Public build arguments are limited to values safe
for browser bundles; server secrets remain runtime environment variables.
