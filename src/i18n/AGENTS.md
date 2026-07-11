# Internationalization

This directory defines supported locales, request message loading, and locale-aware navigation.

## Locale Source of Truth

`routing.ts` defines `fr` and `en`, with `fr` as the default:

```typescript
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
})
```

When adding or changing a message key, update both `messages/fr.json` and `messages/en.json`. Keep
namespaces aligned across locales.

## Server and Client Usage

Localized Server Components set the request locale and use `getTranslations`; Client Components use
`useTranslations`. Pass the locale explicitly when translating metadata outside the normal render
context.

Use `Link`, `redirect`, `usePathname`, and `useRouter` from `@/i18n/routing` for locale-bearing
navigation. When a Next.js server redirect needs an explicit locale-prefixed string, build it with
`localizedHref()`.

`request.ts` validates the requested locale and loads its messages. `proxy.ts` owns locale detection
and unprefixed-route rewriting, so coordinate routing changes across all three files.
