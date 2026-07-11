---
paths:
  - "app/**"
  - "src/actions/**"
  - "src/features/**"
  - "src/services/**"
  - "proxy.ts"
  - "next.config.ts"
---

# Next.js App Router Rules

Scope: app/**, src/actions/**, src/features/**, src/services/**, proxy.ts, next.config.ts

## Proactive Behavior

When changing a page, layout, route handler, or proxy, preserve Next.js 16 async request APIs, the
server/client boundary, and each route's independent authorization requirements.

## Async Request APIs

Await `params`, `searchParams`, `cookies()`, `headers()`, and `connection()`:

```typescript
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const requestHeaders = await headers()
}
```

Route-handler segment params are promises as well. Do not reintroduce removed
`serverRuntimeConfig`/`publicRuntimeConfig`; use environment variables.

## Runtime and Components

Keep Better Auth, Prisma, PostgreSQL, `node:crypto`, and `Buffer` usage on the default Node.js runtime.
Prefer Server Components. Add `'use client'` only for hooks, event handlers, context, or browser APIs.

Route-specific components and helpers stay in the nearest `_components/` and `_lib/` directories.
Promote them to `src/` only after they become genuinely reusable.

## Proxy and APIs

The network boundary is `proxy.ts`, not `middleware.ts`. It performs locale rewriting and coarse
page protection. Its matcher excludes `/api`, so each route handler must validate and protect itself.

`reactCompiler: true` is enabled in `next.config.ts`. Avoid adding manual memoization without a
measured need.

## Mutation Revalidation

Use `revalidatePath()` after a successful route-specific mutation. Use tags only when the data is
actually cached and shared across multiple consumers; this application currently performs many
request-time database reads.
