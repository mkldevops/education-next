---
paths:
  - "app/**"
  - "src/i18n/**"
  - "src/features/**/*.tsx"
  - "messages/**"
  - "proxy.ts"
  - "next.config.ts"
---

# next-intl Rules

Scope: app/**, src/i18n/**, src/features/**/*.tsx, messages/**, proxy.ts, next.config.ts

## Proactive Behavior

When adding or renaming user-facing text, update every locale file and verify locale-aware navigation.
Supported locales are `fr` and `en`, with `fr` as the default.

## Server and Client Translation

```typescript
// Server Component
setRequestLocale(locale)
const t = await getTranslations('dashboard.pages.students')

// Client Component
const t = useTranslations('dashboard.pages.students')
```

Pass `{ locale, namespace }` to `getTranslations()` for metadata or other work outside the established
render context.

## Navigation

Use `Link`, `redirect`, `usePathname`, and `useRouter` from `@/i18n/routing` when navigation carries a
locale. Use `localizedHref()` when a Next.js server redirect needs a concrete prefixed URL.

Next.js navigation APIs remain appropriate for non-routing behavior such as `notFound()`,
`forbidden()`, and `router.refresh()`. Do not replace those mechanically.

## Messages and Routing

Add each key to both `messages/fr.json` and `messages/en.json`, keeping namespaces aligned. Coordinate
locale changes across `src/i18n/routing.ts`, `src/i18n/request.ts`, message files, and `proxy.ts`.
