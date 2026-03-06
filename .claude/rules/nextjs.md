# Next.js 16 (App Router)

## Structure du projet

- `app/` est réservé EXCLUSIVEMENT au routing (page.tsx, layout.tsx, error.tsx, loading.tsx, route.ts)
- Tout le code métier, composants, hooks, services vivent dans `src/` (hors `app/`)
- Ne JAMAIS mettre de logique métier directement dans `app/`

## Colocation : `_components` / `_lib` vs `src/components`

- `_components/` et `_lib/` (préfixe underscore) dans un segment de route `app/**/` = spécifiques à cette route uniquement
- Ne JAMAIS importer un fichier de `_components/` ou `_lib/` depuis un autre segment de route
- `src/components/` contient UNIQUEMENT les composants utilisés dans 2+ routes
- Règle de promotion : créer dans `_components/` d'abord, migrer vers `src/components/` quand réutilisé ailleurs
- Ne JAMAIS créer directement dans `src/components/` un composant utilisé qu'une seule fois

## proxy.ts (remplace middleware.ts)

- Le fichier s'appelle `proxy.ts` à la racine du projet, PAS `middleware.ts`
- Export default : fonction nommée `proxy`
- Runtime Node.js (pas Edge)
- Réservé aux préoccupations réseau : auth gates, redirects, headers
- Ne JAMAIS y mettre de logique métier

## Cache Components (`"use cache"`)

- Caching opt-in via directive `"use cache"` (pas de caching implicite)
- `cacheComponents: true` doit être activé dans `next.config.ts`
- Applicable au niveau fichier, composant ou fonction
- Ne JAMAIS accéder à `cookies()`, `headers()`, `searchParams` dans une fonction `"use cache"` — les passer en paramètres
- Utiliser `cacheTag()` pour taguer les données cachées
- Utiliser `updateTag()` pour les mutations interactives (read-your-writes immédiat)
- Utiliser `revalidateTag()` quand un léger délai est acceptable

## Server vs Client Components

- Par défaut tout composant dans `app/` est un Server Component
- N'ajouter `"use client"` que si nécessaire : useState, useEffect, event handlers, browser APIs
- Créer des Server Components wrapper qui fetchent les données et les passent aux Client Components
- Ne JAMAIS mettre `"use client"` sur un composant qui n'en a pas besoin

## Server Actions

- Déclarer avec `"use server"` en haut du fichier
- Les placer dans `_lib/` du segment de route si spécifiques, `src/services/` si partagées
- Toujours valider les inputs avec Zod côté serveur
- Utiliser `revalidatePath()` ou `updateTag()` après mutation

## Fichiers de convention et bundler

- Toujours utiliser les fichiers de convention Next.js (`error.tsx`, `loading.tsx`, `not-found.tsx`, `forbidden.tsx`, `unauthorized.tsx`) dans `app/`
- Turbopack est le bundler par défaut, ne pas ajouter `--turbopack` aux scripts
- Conventions de nommage routes : kebab-case pour les dossiers de route (`user-settings/`, `order-history/`)
