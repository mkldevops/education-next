# Repository Guidelines

Localized (fr/en) education-management application: families, students, enrollments, classes,
payments, administration. Next.js 16 App Router.

`package.json`, `pnpm-lock.yaml`, and checked-in configuration are the version source of truth. Never
infer a dependency version from documentation.

Layer conventions, auth, Prisma, i18n, styling, and testing rules load from `.agents/rules/`. This file
only carries what those rules and the code itself do not.

## Toolchain

Use `pnpm` for every workflow; the repository pins `pnpm@11.1.2`.

No `engines` field exists. Docker and CI pin Node.js 22, so a runtime upgrade must update `Dockerfile`,
CI, and developer setup together rather than changing only docs.

## Business rules

`docs/business-rules.md` records the rules the application enforces and where they live. Read it before
changing domain rules, use cases, or feature schemas, and update it in the same commit.

## Verification

`pnpm dev` starts Docker services through `predev`. Local verification requires a `.env` based on
`.env.example`; DB-backed work also needs `pnpm db:start`.

Run the CI-equivalent sequence before opening a pull request:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm lint:tw
pnpm type-check
pnpm test
pnpm knip
pnpm build
```

`pnpm knip` detects unused code, files, and dependencies, and is part of CI. `pnpm lint:tw` flags Tailwind
arbitrary values that have a canonical utility; `pnpm lint:tw:fix` rewrites them.

## Database and deployment

- `pnpm db:seed` deletes existing records before creating fixtures. Disposable local data only.
- `pnpm db:seed:demo` creates or rebuilds only the `ecole-demo` school and its three `@ecole-demo.test`
  accounts, leaving other schools intact; `--remove` deletes them. Dates are relative to the run day.
- `pnpm db:push` is local prototyping. Shared and production schema changes need a reviewed migration.
- Docker Compose runs PostgreSQL and Mailpit, not the application.
- Branding image uploads go to the shared MinIO at `S3_ENDPOINT` in every environment, local included.
  Without the `S3_*` variables the upload degrades to `notConfigured` and a URL can still be typed by hand.
- No Vercel or Coolify deployment configuration is tracked. Do not infer a deployment target from ignored
  local files.

## Pull requests

Summarize the change, link relevant work, include screenshots for UI changes, and call out schema,
migration, seed, or environment changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
