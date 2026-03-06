# education-next

SaaS starter built with Next.js 16, TypeScript, and Clean Architecture.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Linter | Biome |
| Tests | Vitest + Testing Library |
| Validation | Zod 4 |
| i18n | next-intl (fr, en) |
| Animation | Motion |
| ORM | Prisma 6 |
| Database | PostgreSQL 18 |
| Auth | Better Auth |
| State | Zustand |
| Email | Resend (Mailpit in dev) |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start Docker services (PostgreSQL, Mailpit)
pnpm db:start

# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push

# Start development server (port 8550)
pnpm dev
```

### Docker Services

| Service | Port | URL |
|---------|------|-----|
| App | ${PORT} | http://localhost:8550 |
| PostgreSQL | ${PORT_POSTGRES} | — |
| Mailpit SMTP | ${PORT_MAILPIT_SMTP} | — |
| Mailpit Web | ${PORT_MAILPIT_WEB} | http://localhost:8553 |

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # Lint with Biome
pnpm lint:fix         # Lint + auto-fix
pnpm type-check       # TypeScript check
pnpm test             # Run tests
pnpm knip             # Dead code detection
pnpm db:start         # Start Docker services
pnpm db:stop          # Stop Docker services
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to DB
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
```

## Architecture

Clean Architecture with clear separation of concerns:

```
Server Action (API boundary)
  ↓
Use Case (business logic)
  ↓
Domain Entity (business rules)
  ↓
Gateway (infrastructure)
```

### Project Structure

```
app/[locale]/             # i18n routes (App Router) — routing only
  ├── _components/        # Route-specific components
  └── _lib/               # Route-specific actions/utils
src/
├── features/             # Feature modules (navbar, footer, hero, auth)
├── use-cases/            # Application logic
├── domain/               # Business entities
├── gateways/             # Infrastructure adapters (DB, API, email)
├── components/ui/        # Reusable components (shadcn/ui)
├── lib/                  # Utilities
├── styles/               # CSS (Tailwind v4)
├── i18n/                 # i18n configuration
├── types/                # TypeScript types
```

## License

Private
