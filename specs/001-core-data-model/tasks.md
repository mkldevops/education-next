# Tasks: Core Data Model — Enrollment Management

**Input**: Design documents from `/specs/001-core-data-model/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Prisma schema complet et infrastructure partagée

- [x] T001 Add all enums (Sex, RelationType, EnrollmentStatus, PaymentMethod, ConfigValueType) to prisma/schema.prisma
- [x] T002 Add User model extension (roles Json, isActive) to existing Better Auth models in prisma/schema.prisma
- [x] T003 Add Family, UserFamily, Person, FamilyPerson, Student, PhoneNumber models to prisma/schema.prisma
- [x] T004 Add Level (with self-ref nextLevel), Period, ClassPeriod models to prisma/schema.prisma
- [x] T005 Add Enrollment, ClassAssignment, Payment, Plan models to prisma/schema.prisma
- [x] T006 Add Config model to prisma/schema.prisma
- [x] T007 Add all relations, indexes, and unique constraints to prisma/schema.prisma
- [x] T008 Run prisma db push and prisma generate to validate schema
- [x] T009 Create Prisma client singleton with soft-delete extension in src/lib/db.ts
- [x] T010 [P] Create shared enum types in src/types/enums.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain entities with business rules shared across multiple user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Create Enrollment domain entity with state machine (pending/active/completed/cancelled transitions) in src/domain/enrollment.ts
- [x] T012 [P] Create Period domain entity with overlap validation in src/domain/period.ts
- [x] T013 [P] Create Level domain entity with nextLevel chain logic in src/domain/level.ts
- [x] T014 [P] Create ClassPeriod domain entity with capacity check in src/domain/class-period.ts
- [x] T015 [P] Create Payment domain entity with distribution algorithm in src/domain/payment.ts

**Checkpoint**: Foundation ready — all domain rules testable, user story implementation can begin

---

## Phase 3: User Story 1 — Gestion des familles et élèves (Priority: P1) MVP

**Goal**: Créer des fiches famille avec personnes, contacts et élèves rattachés

**Independent Test**: Créer une famille → ajouter une personne (parent) → ajouter un téléphone → créer un élève → vérifier dans la liste

### Implementation for User Story 1

- [x] T016 [P] [US1] Create Family domain entity in src/domain/family.ts
- [x] T017 [P] [US1] Create Student domain entity in src/domain/student.ts
- [x] T018 [P] [US1] Create family-gateway with create, update, deactivate, list, addPerson, linkUser in src/gateways/family-gateway.ts
- [x] T019 [P] [US1] Create person-gateway with create, update, addPhone in src/gateways/person-gateway.ts
- [x] T020 [P] [US1] Create student-gateway with create, update, deactivate, list, findByFamily in src/gateways/student-gateway.ts
- [x] T021 [US1] Create use-case createFamily in src/use-cases/families/create-family.ts
- [x] T022 [P] [US1] Create use-case updateFamily in src/use-cases/families/update-family.ts
- [x] T023 [P] [US1] Create use-case deactivateFamily in src/use-cases/families/deactivate-family.ts
- [x] T024 [US1] Create use-case addPersonToFamily in src/use-cases/families/add-person-to-family.ts
- [x] T025 [US1] Create use-case linkUserToFamily in src/use-cases/families/link-user-to-family.ts
- [x] T026 [US1] Create use-case createStudent (via family) in src/use-cases/students/create-student.ts
- [x] T027 [P] [US1] Create use-case updateStudent in src/use-cases/students/update-student.ts
- [x] T028 [P] [US1] Create use-case deactivateStudent in src/use-cases/students/deactivate-student.ts
- [x] T029 [P] [US1] Create Zod validation schemas for Family, Person, Student, PhoneNumber in src/use-cases/families/schemas.ts and src/use-cases/students/schemas.ts

**Checkpoint**: Families and students can be created, linked, and listed. MVP functional.

---

## Phase 4: User Story 2 — Gestion des périodes, niveaux et classes (Priority: P2)

**Goal**: Configurer les périodes scolaires, niveaux et classes périodiques

**Independent Test**: Créer une période → un niveau → une classe périodique rattachée → vérifier les places disponibles

### Implementation for User Story 2

- [x] T030 [P] [US2] Create period-gateway with create, update, list, checkOverlap in src/gateways/period-gateway.ts
- [x] T031 [P] [US2] Create level-gateway with create, update, list, setNextLevel in src/gateways/level-gateway.ts
- [x] T032 [P] [US2] Create class-period-gateway with create, update, list, countEnrolled in src/gateways/class-period-gateway.ts
- [x] T033 [US2] Create use-case createPeriod with overlap validation in src/use-cases/periods/create-period.ts
- [x] T034 [P] [US2] Create use-case updatePeriod in src/use-cases/periods/update-period.ts
- [x] T035 [US2] Create use-case createLevel in src/use-cases/levels/create-level.ts
- [x] T036 [US2] Create use-case setNextLevel with circular reference check in src/use-cases/levels/set-next-level.ts
- [x] T037 [US2] Create use-case createClassPeriod in src/use-cases/class-periods/create-class-period.ts
- [x] T038 [P] [US2] Create use-case updateClassPeriod with capacity validation in src/use-cases/class-periods/update-class-period.ts
- [x] T039 [P] [US2] Create Zod validation schemas for Period, Level, ClassPeriod in src/use-cases/periods/schemas.ts, src/use-cases/levels/schemas.ts, src/use-cases/class-periods/schemas.ts

**Checkpoint**: Academic structure can be configured. Ready for enrollments.

---

## Phase 5: User Story 3 — Inscription des élèves (Priority: P3)

**Goal**: Inscrire un élève dans une classe avec un plan tarifaire, gérer les transitions de statut et la réaffectation

**Independent Test**: Inscrire un élève → vérifier statut pending → activer → réaffecter vers une autre classe → annuler

### Implementation for User Story 3

- [x] T040 [P] [US3] Create plan-gateway with create, update, list in src/gateways/plan-gateway.ts
- [x] T041 [P] [US3] Create enrollment-gateway with create, findById, updateStatus, list in src/gateways/enrollment-gateway.ts
- [x] T042 [P] [US3] Create class-assignment-gateway with create, closeCurrent, findCurrent in src/gateways/class-assignment-gateway.ts
- [x] T043 [US3] Create use-case createPlan in src/use-cases/plans/create-plan.ts
- [x] T044 [US3] Create use-case createEnrollment with capacity check, duplicate check, and initial ClassAssignment in src/use-cases/enrollments/create-enrollment.ts
- [x] T045 [US3] Create use-case activateEnrollment using domain state machine in src/use-cases/enrollments/activate-enrollment.ts
- [x] T046 [P] [US3] Create use-case completeEnrollment using domain state machine in src/use-cases/enrollments/complete-enrollment.ts
- [x] T047 [P] [US3] Create use-case cancelEnrollment using domain state machine in src/use-cases/enrollments/cancel-enrollment.ts
- [x] T048 [US3] Create use-case reassignClass (close current ClassAssignment, create new) in src/use-cases/enrollments/reassign-class.ts
- [x] T049 [P] [US3] Create use-case applyDiscount with recalculation in src/use-cases/enrollments/apply-discount.ts
- [x] T050 [P] [US3] Create Zod validation schemas for Plan, Enrollment, ClassAssignment in src/use-cases/plans/schemas.ts and src/use-cases/enrollments/schemas.ts

**Checkpoint**: Full enrollment lifecycle operational. Students can be enrolled, promoted, and reassigned.

---

## Phase 6: User Story 4 — Gestion des paiements (Priority: P4)

**Goal**: Enregistrer des paiements sur la fiche famille avec répartition proportionnelle sur les inscriptions

**Independent Test**: Enregistrer un paiement de 200€ sur une famille avec 2 inscriptions de 500€ → vérifier 100€ par inscription

### Implementation for User Story 4

- [x] T051 [US4] Create payment-gateway with create, listByFamily, listByEnrollment, calculateBalance in src/gateways/payment-gateway.ts
- [x] T052 [US4] Create use-case recordPayment with proportional distribution and overpayment check in src/use-cases/payments/record-payment.ts
- [x] T053 [P] [US4] Create Zod validation schema for Payment in src/use-cases/payments/schemas.ts

**Checkpoint**: Payments can be recorded with correct distribution. Financial tracking operational.

---

## Phase 7: User Story 6 — Configuration par déploiement (Priority: P6)

**Goal**: Interface de configuration clé/valeur typée pour paramétrer le déploiement

**Independent Test**: Créer un config "automatic_promotion" boolean → le modifier → vérifier la validation de type

_Note: US5 (Portail famille) est reportée car elle nécessite des routes UI et Stripe. US6 est avancée car elle ne dépend que du data model._

### Implementation for User Story 6

- [x] T054 [US6] Create config-gateway with get, set, list in src/gateways/config-gateway.ts
- [x] T055 [US6] Create use-case setConfig with type validation in src/use-cases/config/set-config.ts
- [x] T056 [P] [US6] Create use-case getConfig in src/use-cases/config/get-config.ts
- [x] T057 [P] [US6] Create Zod validation schema for Config in src/use-cases/config/schemas.ts

**Checkpoint**: Deployment configuration operational. Multi-tenant parameters manageable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cohérence, et qualité

- [x] T058 Run pnpm type-check and fix all TypeScript errors
- [x] T059 Run pnpm lint:fix and fix all Biome errors
- [x] T060 Verify all domain entities follow Result type pattern ('OK' | error code)
- [x] T061 Verify soft-delete extension works correctly on Person, Student, Family, Enrollment
- [x] T062 Add i18n translation keys for all error codes in messages/fr.json and messages/en.json

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema must exist) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start immediately after
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 3 (students) + Phase 4 (classes, periods, levels)
- **US4 (Phase 6)**: Depends on Phase 5 (enrollments must exist for payments)
- **US6 (Phase 7)**: Depends on Phase 2 only — can run in parallel with US1-US4
- **Polish (Phase 8)**: Depends on all previous phases

### Parallel Opportunities

```
Phase 2: T012, T013, T014, T015 can all run in parallel
Phase 3: T016+T017 parallel, T018+T019+T020 parallel, T022+T023 parallel, T027+T028+T029 parallel
Phase 4: T030+T031+T032 parallel, T034+T039 parallel
Phase 5: T040+T041+T042 parallel, T046+T047 parallel, T049+T050 parallel
Phase 7: T056+T057 parallel
```

### User Story Dependencies

```
US1 (P1) ─────────────────────────┐
                                   ├──> US3 (P3) ──> US4 (P4)
US2 (P2) ─────────────────────────┘
US6 (P6) ── independent (after Phase 2)
US5 (P5) ── deferred (needs UI routes + Stripe)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + db.ts)
2. Complete Phase 2: Domain entities
3. Complete Phase 3: US1 — Families & Students
4. **STOP and VALIDATE**: Test family/student CRUD
5. Commit and continue

### Incremental Delivery

1. Setup + Foundational → Schema ready
2. US1 → Families & students → Commit (MVP)
3. US2 → Periods, levels, classes → Commit
4. US3 → Enrollments → Commit
5. US4 → Payments → Commit
6. US6 → Config → Commit
7. Polish → Final commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US5 (Portail famille) is deferred — requires UI routes and Stripe integration
- Commit after each completed user story phase
- All gateways use Prisma client from src/lib/db.ts (with soft-delete extension)
- All use-cases validate input with Zod before calling gateways
- All use-cases return Result type ('OK' | typed error code)
