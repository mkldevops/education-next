---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "vitest.config.ts"
  - "src/test/**"
  - "src/domain/**"
  - "src/use-cases/**"
  - "src/components/**"
  - "src/features/**"
  - "app/**/_components/**"
---

# Vitest Rules

Scope: **/*.test.*, **/*.spec.*, vitest.config.ts, src/test/**, src/domain/**, src/use-cases/**,
  src/components/**, src/features/**, app/**/_components/**

## Proactive Behavior

Add or update tests for changed domain rules, use cases, and stateful UI behavior. Match the test style
already used by the directory instead of imposing one mocking pattern on the whole project.

## Current Configuration

Vitest runs with globals and `jsdom`. `@` resolves to `src` and `@peaklab/ui` resolves to
`src/components/ui`; every tsconfig path alias needs a matching entry in `vitest.config.ts`. Domain and
utility tests commonly live in `__tests__/`, while use-case tests are adjacent as `*.test.ts`.

`vitest.config.ts` registers `setupFiles: ['./src/test/setup.ts']`, which imports
`@testing-library/jest-dom/vitest` and runs RTL `cleanup()` in `afterEach`. Jest-dom matchers and
automatic cleanup are therefore available in every test; do not re-register them per file.

## Use-Case Tests

Most use-case tests mock gateways or `@/lib/db` before dynamically importing the subject. The
interface-based profile use cases inject hand-written gateway spies. Preserve the local approach and
assert typed business results, persistence calls, and rejected invalid input.

Run `pnpm test` for the full suite; use `pnpm test:watch` only for interactive development.
