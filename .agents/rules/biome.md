# Biome Rules

Scope: always loaded (cross-cutting)

## Proactive Behavior

Use Biome for linting, import organization, and formatting. Do not introduce ESLint or Prettier
commands into this repository.

## Commands

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm type-check
```

The pre-commit hook runs `pnpm exec lint-staged`. Its glob includes JavaScript, TypeScript, JSON, CSS,
and Markdown, but Biome ignores file types excluded or unsupported by the current configuration;
notably, `biome.json` excludes CSS. The pre-push hook runs `pnpm test`.

## Formatting and Types

Use 2-space indentation, single quotes, no semicolons, ES5 trailing commas, and a 100-column target.
Biome enforces `import type` for type-only imports.

Biome does not check identifier or filename casing. Use `PascalCase` for components and types,
`camelCase` for functions and variables, and descriptive kebab-case filenames such as
`create-family.ts` and `edit-plan-dialog.tsx`.

Use `biome-ignore` with the exact rule and a concrete reason when suppression is unavoidable:

```typescript
// biome-ignore lint/suspicious/noExplicitAny: upstream payload has no published type
function parsePayload(value: any) {}
```

Fix the underlying issue before adding a suppression, and never use `eslint-disable` comments.
