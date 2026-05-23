# Repository Guidelines

## Project Structure & Module Organization

This repository is a Next.js 16 App Router application with a Clean Architecture split. Route entry points live in `app/`, with localized pages under `app/[locale]/` and route-scoped helpers in `_components/` and `_lib/`. Core application code lives in `src/`: `domain/` holds business entities, `use-cases/` contains application logic, `gateways/` wraps infrastructure, `features/` groups UI by feature, and `components/ui/` contains reusable primitives. Database schema, migrations, and seeding live in `prisma/`. Static assets live in `public/`.

## Build, Test, and Development Commands

Use `pnpm` for all workflows.

- `pnpm dev` runs the local app with environment loading; `predev` starts Docker services first.
- `pnpm build` creates a production build; `pnpm build:prod` also runs Prisma generate and deploy migrations.
- `pnpm lint`, `pnpm lint:fix`, and `pnpm format` run Biome checks and auto-fixes.
- `pnpm type-check` runs strict TypeScript without emitting files.
- `pnpm test` runs the Vitest suite once; `pnpm test:watch` runs it interactively.
- `pnpm db:start`, `pnpm db:stop`, `pnpm db:generate`, `pnpm db:push`, `pnpm db:migrate`, and `pnpm db:seed` manage the local Prisma/Postgres workflow.

## Coding Style & Naming Conventions

Biome is the formatter and linter. Use 2-space indentation, single quotes, trailing commas where Biome applies them, and keep lines near 100 columns. Prefer TypeScript with strict typing and import types where possible. Use `PascalCase` for React components, `camelCase` for functions and variables, and kebab-free descriptive filenames such as `create-family.ts`, `edit-plan-dialog.tsx`, and `search-service.ts`. Use the `@/*` alias for imports from `src/`.

## Testing Guidelines

Vitest runs in `jsdom` with globals enabled. Keep tests close to the code they cover: domain and utility tests live in `__tests__/`, while many use-case tests sit beside the implementation as `*.test.ts`. Match existing naming patterns like `src/use-cases/families/create-family.test.ts`. Run `pnpm test` before opening a PR; add or update tests for any change in domain rules, use cases, or UI behavior with stateful logic.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits such as `fix(auth): add Zod validation...` and `feat(families): overhaul family detail UX...`. Keep commits scoped and use `feat`, `fix`, `refactor`, `test`, or `docs` with a clear area in parentheses. PRs should include a short summary, linked issue or task when available, screenshots for UI changes, and notes for schema or environment updates. If Prisma schema changes, include the migration and mention any required seed or deploy steps.
