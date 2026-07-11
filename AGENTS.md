# Repository Guidelines

## Project Overview

This is a localized education-management application for families, students, enrollments, classes,
payments, and administration. It uses the Next.js 16 App Router with a hybrid Clean Architecture:
route code owns HTTP and rendering concerns, while mutation flows usually pass through use cases,
domain rules, and infrastructure gateways.

The current stack is Next.js 16.2, React 19.2, strict TypeScript 6.0, Prisma 7.8 with PostgreSQL 18,
Better Auth 1.6, next-intl 4.12, Tailwind CSS 4.3, Zod 4.4, Zustand 5, Biome 2.4, and Vitest 4.1.
Treat `package.json`, `pnpm-lock.yaml`, and checked-in configuration as the version source of truth.

## Package Manager and Runtime

Use `pnpm` for every workflow; the repository pins `pnpm@11.1.2`.

No Node engine file or `engines` field exists. Docker and CI currently pin Node.js 22, so a runtime
upgrade must update `Dockerfile`, CI, and developer setup together rather than changing only docs.

## Project Structure

- `app/` contains App Router entry points. Localized routes live under `app/[locale]/`, with
  route-owned UI in `_components/` and actions/helpers in `_lib/`.
- Dashboard Server Components perform view-specific Prisma reads directly. Route-scoped mutations
  authenticate first, call use cases, and revalidate only after success.
- `src/use-cases/` holds application operations; `src/domain/` holds pure business rules;
  `src/gateways/` wraps most persistence and email infrastructure.
- Some atomic use cases own a direct `db.$transaction`; do not claim every database call passes
  through a gateway.
- `src/features/` contains reusable feature UI, `src/actions/` contains cross-route actions, and
  `src/components/ui/` contains reusable UI primitives.
- `prisma/` contains the schema, checked-in migrations, and destructive local seed data.
- `@/*` resolves to `src/*`; `@peaklab/ui` resolves to the UI barrel.

## Development Commands

- `pnpm dev` starts Docker services through `predev`, loads `.env`, and runs Next.js.
- `pnpm build` creates the standard build; `pnpm build:prod` generates Prisma Client, deploys
  migrations, and builds.
- `pnpm start` starts the built application with environment loading.
- `pnpm lint`, `pnpm lint:fix`, and `pnpm format` check, fix, and format with Biome.
- `pnpm type-check` runs TypeScript without emitting files.
- `pnpm test` runs Vitest once; `pnpm test:watch` starts watch mode.
- `pnpm knip` detects unused code, files, and dependencies.
- `pnpm db:start` and `pnpm db:stop` manage PostgreSQL and Mailpit.
- `pnpm db:generate`, `pnpm db:push`, `pnpm db:migrate`, `pnpm db:studio`, and `pnpm db:seed`
  manage local Prisma workflows. Use versioned migrations for shared or production schema changes.

## Authentication and Authorization

Better Auth is configured server-side in `src/lib/auth.ts`; Client Components use the named exports
from `src/lib/auth-client.ts`. Server code reads sessions with
`auth.api.getSession({ headers: await headers() })`.

`proxy.ts` and the dashboard layout provide coarse route protection, but `/api` is excluded from the
proxy. Every API route and Server Action must validate its own inputs and enforce the appropriate
session, role, ownership, or family scope before accessing protected data. Invitation acceptance and
the passkey authentication stages are intentionally public exceptions.

Dashboard authorization helpers live in `app/[locale]/(dashboard)/_lib/auth-helper.ts`. Parent-facing
queries must be constrained by the authenticated `familyId`; inaccessible resources use `notFound()`
to avoid disclosing their existence. If a parent has no linked family, deny access before constructing
the query—never pass an optional `familyId` into a Prisma filter.

## Important Patterns and Conventions

- Await `params`, `searchParams`, `cookies()`, and `headers()`; keep auth and Prisma code on the
  default Node.js runtime.
- Localized routes support `fr` and `en`, defaulting to `fr`. Update both message files together and
  use `@/i18n/routing` for locale-bearing navigation.
- Action result contracts vary by feature. Preserve the surrounding contract instead of imposing a
  universal response shape.
- Prisma Client is generated into `src/generated/prisma`. Import application client types from
  `@/generated/prisma/client`, and use the shared `db` export from `@/lib/db`.
- UI primitives are local Tailwind/CVA components. Do not assume a component uses Radix APIs merely
  because `components.json` contains shadcn-compatible configuration.

## Coding Style

Biome is the formatter and linter. Use 2-space indentation, single quotes, no semicolons, ES5 trailing
commas, and lines near 100 columns. Prefer strict TypeScript and `import type` for type-only imports.

Use `PascalCase` for components and types, `camelCase` for functions and variables, and descriptive
kebab-case filenames such as `create-family.ts` and `edit-plan-dialog.tsx`. Keep changes simple,
narrowly scoped, and free of unnecessary comments.

## Testing and Verification

Domain and utility tests commonly live in `__tests__/`; use-case tests are usually adjacent as
`*.test.ts`. Follow the existing test style in the area: most use cases mock gateways or `db`, while
interface-based profile use cases use hand-written spies.

Run the CI-equivalent sequence before opening a pull request:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm type-check
pnpm test
pnpm knip
pnpm build
```

Local verification requires a valid `.env` based on `.env.example` and, for DB-backed work, the
Docker services. Add or update tests for domain rules, use cases, and stateful UI behavior.

## Database and Deployment Notes

Schema changes require a reviewed migration and regenerated client. `pnpm db:push` is local
prototyping only; production uses `prisma migrate deploy`. The seed deletes existing records before
creating fixtures, so run it only against disposable local data.

Docker Compose runs PostgreSQL and Mailpit, not the application. The Docker image performs Prisma
generation and a standard Next.js build but does not deploy migrations. No Vercel or Coolify
deployment configuration is tracked; do not infer a deployment target from ignored local files.

## Commits and Pull Requests

Use scoped Conventional Commits such as `feat(auth): ...`, `fix(families): ...`, or `docs(ai): ...`.
Pull requests should summarize the change, link relevant work, include screenshots for UI changes,
and call out schema, migration, seed, or environment changes.
