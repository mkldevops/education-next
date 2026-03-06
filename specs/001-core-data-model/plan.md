# Implementation Plan: Core Data Model — Enrollment Management

**Branch**: `001-core-data-model` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-core-data-model/spec.md`

## Summary

Implémenter le modèle de données complet de l'application de gestion d'inscriptions scolaires : 13 entités Prisma (User, Family, Person, Student, PhoneNumber, Config, Level, Period, ClassPeriod, Enrollment, ClassAssignment, Payment, Plan), les relations entre elles, les enums (EnrollmentStatus, PaymentMethod, RelationType, Sex, ConfigValueType), les règles métier (machine à états, anti-surpaiement, soft-delete), et la couche domain/gateway/use-case pour les CRUD de base.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 22
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6, Zod 4, Better Auth, next-intl
**Storage**: PostgreSQL 18 via Prisma ORM
**Testing**: Vitest + Testing Library (Spy pattern)
**Target Platform**: Web (mobile-first, 375px primary viewport)
**Project Type**: Web application (full-stack)
**Performance Goals**: LCP < 2.5s on 4G
**Constraints**: Mobile-first, multi-tenant ready (configurable periods), soft-delete on sensitive entities
**Scale/Scope**: Single-school deployment, ~500 families, ~1000 students, ~50 classes per period

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Mobile-First | PASS | FR-036 requires 375px usability. UI work deferred to feature stories |
| II. Multi-Tenant Ready | PASS | Period entity has configurable dates (FR-008), Level names are free-form (FR-010), Config entity for deployment settings (FR-029) |
| III. Data Integrity | PASS | State machine on Enrollment (FR-013), anti-overpayment (FR-023), soft-delete (FR-007), isActive/createdAt/updatedAt on all entities (FR-034), server-side validation (FR-035) |
| IV. Family-Centric | PASS | Student requires Family (FR-005), payments at Family level (FR-022), family portal read-only (FR-025/027) |
| V. Simplicity | PASS | No speculative features. Direct Prisma access for single-use operations. Domain entities only where business rules exist |

All gates pass. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-core-data-model/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma        # All 13 entities + enums + relations
└── migrations/          # Prisma migrations

src/
├── domain/
│   ├── enrollment.ts    # Enrollment entity + state machine rules
│   ├── payment.ts       # Payment distribution logic
│   ├── family.ts        # Family entity
│   ├── student.ts       # Student entity (extends Person fields)
│   ├── period.ts        # Period entity + overlap validation
│   ├── level.ts         # Level entity + promotion chain
│   ├── class-period.ts  # ClassPeriod entity + capacity check
│   └── plan.ts          # Plan entity
├── gateways/
│   ├── family-gateway.ts
│   ├── student-gateway.ts
│   ├── person-gateway.ts
│   ├── enrollment-gateway.ts
│   ├── payment-gateway.ts
│   ├── period-gateway.ts
│   ├── level-gateway.ts
│   ├── class-period-gateway.ts
│   ├── class-assignment-gateway.ts
│   ├── plan-gateway.ts
│   └── config-gateway.ts
├── use-cases/
│   ├── families/        # Create, update, deactivate, list
│   ├── students/        # Create (via family), update, deactivate, list
│   ├── periods/         # Create, update, validate overlap
│   ├── levels/          # Create, update, set next level
│   ├── class-periods/   # Create, update, check capacity
│   ├── enrollments/     # Create, transition status, reassign class
│   ├── payments/        # Record, distribute, prevent overpayment
│   ├── plans/           # Create, update
│   └── config/          # Get, set
├── lib/
│   └── db.ts            # Prisma client singleton
└── types/
    └── enums.ts         # Shared enum types
```

**Structure Decision**: Next.js App Router with Clean Architecture (Server Action → Use Case → Domain → Gateway). Code organized by domain, not by technical layer. This feature focuses on the backend layers (prisma, domain, gateways, use-cases). UI routes will be added in subsequent feature stories.

## Complexity Tracking

No violations to justify — all design decisions align with constitution principles.
