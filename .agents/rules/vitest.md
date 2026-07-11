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

Vitest runs with globals and `jsdom`; `@` resolves to `src`. Domain and utility tests commonly live in
`__tests__/`, while use-case tests are adjacent as `*.test.ts`.

`src/test/setup.ts` exists but `vitest.config.ts` does not currently register `setupFiles`. Do not
assume jest-dom matchers or automatic RTL cleanup are active. If a new component test depends on that
setup, wire it explicitly and verify the full suite in the same change.

## Use-Case Tests

Most use-case tests mock gateways or `@/lib/db` before dynamically importing the subject. The
interface-based profile use cases inject hand-written gateway spies. Preserve the local approach and
assert typed business results, persistence calls, and rejected invalid input.

Run `pnpm test` for the full suite; use `pnpm test:watch` only for interactive development.
