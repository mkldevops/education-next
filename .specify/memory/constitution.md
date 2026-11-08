<!--
  Sync Impact Report
  ===================
  Version change: 1.0.0 → 1.1.0
  Modified principles: None (all 5 retained as-is)
  Added sections: None
  Expanded sections:
    - Technology Stack: added precise versions, tooling, Docker services
    - Development Workflow: added Clean Architecture flow, conventions,
      validation, testing, and i18n patterns from AGENTS.md
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ (compatible, Source Code
      section is generic and filled per-feature by /speckit.plan)
    - .specify/templates/spec-template.md ✅ (compatible, no changes needed)
    - .specify/templates/tasks-template.md ✅ (compatible, path conventions
      are generic and adapted per-feature by /speckit.tasks)
  Follow-up TODOs: None
-->

# Education-Next Constitution

## Core Principles

### I. Mobile-First Design

All interfaces MUST be designed for phone screens as the primary
viewport. Desktop is a secondary concern.

- Every page and form MUST be fully usable on a 375px-wide screen
  without horizontal scrolling
- Touch targets MUST be at minimum 44x44px
- Navigation MUST use mobile-native patterns (bottom nav, slide
  panels, stacked views)
- Forms MUST minimize input friction: use select dropdowns, date
  pickers, and auto-complete over free text where possible
- Performance budget: pages MUST achieve LCP < 2.5s on 4G connections

**Rationale**: The primary users (school staff, families) will use this
application on their phones during enrollment periods, often in
environments with limited connectivity.

### II. Multi-Tenant Ready

The application MUST be deployable to different schools with
configurable academic periods and no code changes.

- Academic periods (start month, end month) MUST be configurable per
  deployment via the Config entity, not hardcoded
- Level names (CP, CE1, Level 1, etc.) MUST be user-defined, never
  assumed by the application logic
- Currency, date formats, and locale MUST follow the deployment's
  configuration
- No school-specific business rules in application code; all
  customizable behavior MUST flow through Config or database settings
- Automatic promotion between levels MUST be opt-in per deployment

**Rationale**: The application targets schools across countries with
different academic calendars (Sept-Aug in France, Oct-Sept elsewhere).
Hard-coding any school-specific logic prevents reuse.

### III. Data Integrity First

Student and family data MUST be accurate, consistent, and protected
at all times.

- All entity mutations MUST go through validated server actions or
  API routes; no direct client-side database writes
- Enrollment status transitions MUST follow a defined state machine
  (e.g., pending → active → completed; no skipping states)
- Payment amounts MUST reconcile with enrollment totalAmount; the
  system MUST prevent overpayment and track partial payments
- Soft-delete MUST be used for Person, Student, Family, and
  Enrollment records; hard deletes are forbidden on these entities
- All entities MUST include isActive, createdAt, and updatedAt fields
  as defined in the data model

**Rationale**: This system manages children's personal data and
financial transactions. Data loss or inconsistency directly impacts
families and school operations.

### IV. Family-Centric Workflow

All student operations MUST flow through the family context.

- A Student MUST belong to a Family before any enrollment can occur
- Enrollment creation MUST be initiated from the Family or Student
  view, never from an orphaned form
- Payments MUST be recorded at the Family level and distributed
  equitably across the family's active enrollments for the period
- Family access (role: family) MUST allow viewing student information
  and making payments, but not modifying student records or
  enrollment status

**Rationale**: The MCD defines Family as the mandatory parent context
for students. Payments are family-level concerns, not per-student,
to match real-world billing practices.

### V. Simplicity Over Features

Build the minimum required for each workflow. Resist feature creep.

- Each feature MUST map to a concrete user story from the spec; no
  speculative features
- UI components MUST be reused across views; no duplicated form logic
  for the same entity
- API surface MUST stay minimal: one endpoint per operation, no
  catch-all endpoints
- Abstraction layers (services, repositories) MUST be introduced only
  when two or more consumers exist; direct data access is acceptable
  for single-use operations
- YAGNI applies: if a capability is not in the current spec, it MUST
  NOT be built

**Rationale**: This is a focused enrollment management tool. Complexity
slows down delivery and increases the maintenance burden for schools
with limited technical resources.

## Technology Stack

| Component  | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                                               |
| Language   | TypeScript (strict)                                                   |
| Styling    | Tailwind CSS v4 + shadcn/ui (new-york)                                |
| Linter     | Biome                                                                 |
| Tests      | Vitest + Testing Library                                              |
| Validation | Zod 4                                                                 |
| i18n       | next-intl (fr, en)                                                    |
| Animation  | Motion (Framer)                                                       |
| ORM        | Prisma 6                                                              |
| Database   | PostgreSQL 18                                                         |
| Auth       | Better Auth (social login, no signup)                                 |
| State      | Zustand                                                               |
| Email      | Resend (Mailpit en dev)                                               |
| Payments   | Cash, card (POS), bank transfer, check (with encashment date), Stripe |
| Roles      | admin (full access), family (read + payment only)                     |

### Docker Services (local development)

| Service      | Port | Description     |
| ------------ | ---- | --------------- |
| PostgreSQL   | 8551 | Base de données |
| Mailpit SMTP | 8552 | Email dev       |
| Mailpit Web  | 8553 | Interface mail  |

All technology choices MUST be validated against the mobile-first and
multi-tenant principles before adoption. New dependencies MUST solve a
concrete problem, not a hypothetical one.

## Development Workflow

### Architecture

```
Server Action (API boundary, "use server")
  ↓
Use Case (logique métier)
  ↓
Domain Entity (règles métier)
  ↓
Gateway (infrastructure: DB, API externes, email)
```

### Project Structure

```
app/[locale]/           # Routes i18n (App Router) — ROUTING UNIQUEMENT
  ├── _components/      # Composants spécifiques à la route
  └── _lib/             # Actions/utils spécifiques à la route
src/
├── features/           # Modules fonctionnels
├── use-cases/          # Logique applicative
├── domain/             # Entités métier
├── gateways/           # Adaptateurs infrastructure
├── components/ui/      # Composants réutilisables (shadcn/ui)
├── lib/                # Utilitaires
├── styles/             # CSS (Tailwind v4)
├── i18n/               # Configuration i18n
├── types/              # Types TypeScript
```

### Conventions

- Every feature MUST start with a specification (spec.md) before
  implementation begins
- Code MUST be organized by domain (families, students, enrollments,
  payments, periods) not by technical layer
- Database schema changes MUST be expressed as Prisma migrations with
  reversibility
- All forms MUST validate with Zod schemas on both client (UX) and
  server (security) using `.safeParse()`
- Result type pattern: server actions MUST return `'OK'` on success
  or a typed error code string on failure
- Tests MUST use the Spy pattern instead of mocks
- `app/` is reserved EXCLUSIVELY for routing files (page.tsx,
  layout.tsx, error.tsx, loading.tsx, route.ts)
- `_components/` and `_lib/` are route-scoped; NEVER import them
  from another route segment
- Components MUST be created in `_components/` first, then promoted
  to `src/components/` only when reused in 2+ routes
- `proxy.ts` at project root replaces `middleware.ts` (Node.js
  runtime, not Edge)
- Commit messages MUST follow conventional commits format
- PRs MUST reference the spec or task they implement

### i18n

- Locales: fr, en (default: fr)
- Translations: `messages/fr.json`, `messages/en.json`
- All translation keys MUST exist in ALL locale files
- Server Component: `const t = await getTranslations('namespace')`
- Client Component: `const t = useTranslations('namespace')`
- Navigation: `import { Link, redirect } from '@/i18n/routing'`

## Governance

This constitution is the highest authority for architectural and
workflow decisions in the education-next project. All implementation
choices MUST comply with the principles defined above.

- **Amendments**: Any principle change requires documentation of the
  rationale, impact analysis on existing code, and a migration plan
  if breaking changes are introduced
- **Versioning**: The constitution follows semantic versioning:
  - MAJOR: Principle removal or backward-incompatible redefinition
  - MINOR: New principle or material expansion of existing guidance
  - PATCH: Clarifications, wording fixes, non-semantic refinements
- **Compliance**: All PRs and code reviews MUST verify alignment with
  these principles. Violations MUST be flagged and resolved before
  merge
- **Review cadence**: The constitution SHOULD be reviewed at the end
  of each major feature delivery to assess relevance

**Version**: 1.1.0 | **Ratified**: 2026-02-19 | **Last Amended**: 2026-03-05
