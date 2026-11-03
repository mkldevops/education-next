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

`compose.yaml` starts PostgreSQL 18 and Mailpit only; it does not run the Next.js application.

One image serves every instance. `.github/workflows/image.yaml` builds it once per `main` commit,
pushes `ghcr.io/mkldevops/education-next:<sha>`, waits for the `quality` check, then points each
Coolify application at that tag and deploys it. The container runs `prisma migrate deploy` from
`/migrate` before `node server.js`, so it refuses to serve a database it has not migrated.
It listens on `::` because Coolify's healthcheck runs `wget localhost` inside the container and
Alpine resolves `localhost` to `::1`; the smoke test repeats that check.

`NEXT_PUBLIC_*` values are never passed at build time: Next would inline them into the shared image.
Server code reads them at runtime; routes that use them must be dynamic (`await connection()`), and
client code derives the origin from `window.location`.

The migrator stage deletes Prisma CLI dependencies that `migrate deploy` does not load. After a Prisma
upgrade, the image workflow's smoke test is what proves that list is still safe.

Docker and CI pin Node.js 26 while the repository pins `pnpm@11.1.2`. A runtime upgrade must update
`Dockerfile`, both workflows, and developer guidance together.

## Compose Safety

Use the standard `compose.yaml` name, named volumes for persistent data, health checks for dependent
services, and read-only mounts for init scripts. PostgreSQL init scripts run only on a fresh volume;
never suggest deleting a volume without warning that it destroys local data.

Keep `.env` out of image layers and version control. Public build arguments are limited to values safe
for browser bundles; server secrets remain runtime environment variables.
