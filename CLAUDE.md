cc# education-next

# MCP Gemini Design

**Gemini is your frontend developer.** For all UI/design work, use this MCP. Tool descriptions contain all necessary instructions.

## Commandes

```bash
pnpm dev              # Démarre Next.js (port 8550)
pnpm build            # Build production
pnpm lint             # Lint (Biome)
pnpm lint:fix         # Lint + fix
pnpm type-check       # Vérification TypeScript
pnpm test             # Tests Vitest
pnpm knip             # Détection code mort
pnpm db:start         # Démarre les services Docker
pnpm db:stop          # Arrête les services Docker
pnpm db:generate      # Génère le client Prisma
pnpm db:push          # Applique le schema sur la DB
pnpm db:migrate       # Migration Prisma
pnpm db:studio        # Ouvre Prisma Studio
```

## Architecture

```
Server Action (API boundary)
  ↓
Use Case (logique métier)
  ↓
Domain Entity (règles métier)
  ↓
Gateway (infrastructure)
```

### Structure

```
app/[locale]/           # Routes i18n (App Router) — ROUTING UNIQUEMENT
  ├── _components/      # Composants spécifiques à la route
  └── _lib/             # Actions/utils spécifiques à la route
src/
├── features/           # Modules fonctionnels (navbar, footer, hero, contact)
├── use-cases/          # Logique applicative
├── domain/             # Entités métier
├── gateways/           # Adaptateurs infrastructure
├── components/ui/      # Composants réutilisables (shadcn/ui)
├── lib/                # Utilitaires
├── styles/             # CSS (Tailwind v4)
├── i18n/               # Configuration i18n
├── types/              # Types TypeScript
```

## Stack technique

| Composant  | Technologie                            |
| ---------- | -------------------------------------- |
| Framework  | Next.js 16 (App Router)                |
| Language   | TypeScript (strict)                    |
| Styling    | Tailwind CSS v4 + shadcn/ui (new-york) |
| Linter     | Biome                                  |
| Tests      | Vitest + Testing Library               |
| Validation | Zod 4                                  |
| i18n       | next-intl (fr, en)                     |
| Animation  | Motion (Framer)                        |
| ORM        | Prisma 6                               |
| Database   | PostgreSQL 18                          |
| Auth       | Better Auth                            |
| State      | Zustand                                |
| Email      | Resend (Mailpit en dev)                |

## i18n

- Locales: fr, en (défaut: fr)
- Traductions: `messages/fr.json`, `messages/en.json`
- Server Component: `const t = await getTranslations('namespace')`
- Client Component: `const t = useTranslations('namespace')`
- Navigation: `import { Link, redirect } from '@/i18n/routing'`

## Docker Services

| Service      | Port | Description     |
| ------------ | ---- | --------------- |
| PostgreSQL   | 8551 | Base de données |
| Mailpit SMTP | 8552 | Email dev       |
| Mailpit Web  | 8553 | Interface mail  |

## Conventions

- **Result type**: `return 'OK'` (succès) ou `return 'errorCode'` (échec typé)
- **Tests**: Pattern Spy au lieu de mocks
- **Code**: Pas de commentaires inutiles, code clair et lisible
- **Imports**: Triés automatiquement par Biome
- **Style**: Single quotes, pas de semicolons, 2 espaces

## Active Technologies
- TypeScript (strict) on Node.js 22 + Next.js 16 (App Router), Prisma 6, Zod 4, Better Auth, next-intl (001-core-data-model)
- PostgreSQL 18 via Prisma ORM (001-core-data-model)

## Recent Changes
- 001-core-data-model: Added TypeScript (strict) on Node.js 22 + Next.js 16 (App Router), Prisma 6, Zod 4, Better Auth, next-intl
