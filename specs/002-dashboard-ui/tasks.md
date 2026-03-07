# Tasks: Dashboard UI — Enrollment Management

**Input**: Design documents from `/specs/001-core-data-model/` + GitHub issues #8-#12
**Prerequisites**: 001-core-data-model (complete), all server actions implemented, all use cases operational

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup — Layout & Theme Foundation

**Purpose**: Fix structural issues and establish the design system before building forms

- [ ] T001 Fix double header: move Navbar/Footer out of root layout into (pages) and (auth) layouts — `app/[locale]/layout.tsx`, `app/[locale]/(pages)/layout.tsx`, `app/[locale]/(auth)/layout.tsx` (ref: issue #10)
- [ ] T002 Create theme config file with color palette (graphite, stormy_teal, white, alabaster_grey, yale_blue) in `src/lib/theme.ts` (ref: issue #9)
- [ ] T003 Update `src/styles/globals.css` — replace hardcoded orange/blue/violet with new palette in `@theme` and `:root`, register all 100-900 shades
- [ ] T004 Search and replace old color references across all components to use new semantic colors
- [ ] T005 Separate sidebar into "Gestion" and "Configuration" sections with group labels in `src/features/dashboard/sidebar.tsx` (ref: issue #11)
- [ ] T006 [P] Add i18n keys for sidebar section labels in `messages/fr.json` and `messages/en.json`
- [ ] T007 Use Gemini Design MCP to generate dashboard layout proposals, select and implement chosen style (ref: issue #12) — `app/[locale]/(dashboard)/layout.tsx`, `src/features/dashboard/sidebar.tsx`, `src/features/dashboard/header.tsx`

**Checkpoint**: Dashboard layout is clean (single header), themed, sidebar organized. Ready for CRUD forms.

---

## Phase 2: Shared UI Components

**Purpose**: Reusable components needed across multiple user stories

- [ ] T008 Create `DataTable` reusable component with sorting in `src/components/ui/data-table.tsx`
- [ ] T009 [P] Create `FormDialog` reusable component (dialog + form + submit/cancel) in `src/components/ui/form-dialog.tsx`
- [ ] T010 [P] Create `ConfirmDialog` reusable component (confirm destructive actions) in `src/components/ui/confirm-dialog.tsx`
- [ ] T011 [P] Create `StatusBadge` component with theme-aware colors in `src/components/ui/status-badge.tsx` (update existing if needed)
- [ ] T012 [P] Create `EmptyState` reusable component in `src/components/ui/empty-state.tsx`
- [ ] T013 [P] Create `toast` notification utility for success/error feedback in `src/lib/toast.ts` (integrate sonner or shadcn toast)

**Checkpoint**: Shared UI toolkit ready. All forms can use consistent patterns.

---

## Phase 3: User Story 1 — Gestion des familles et eleves (Priority: P1)

**Goal**: CRUD complet pour les familles, personnes et eleves via le dashboard

**Independent Test**: Creer une famille via le formulaire, ajouter une personne, ajouter un eleve, modifier, desactiver — tout depuis le dashboard

### Family CRUD UI

- [ ] T014 [US1] Create `CreateFamilyDialog` component in `app/[locale]/(dashboard)/dashboard/families/_components/create-family-dialog.tsx`
- [ ] T015 [US1] Add "Ajouter une famille" button to families list page in `app/[locale]/(dashboard)/dashboard/families/page.tsx`
- [ ] T016 [US1] Create `EditFamilyDialog` component in `app/[locale]/(dashboard)/dashboard/families/_components/edit-family-dialog.tsx`
- [ ] T017 [US1] Create `DeactivateFamilyButton` component in `app/[locale]/(dashboard)/dashboard/families/_components/deactivate-family-button.tsx`
- [ ] T018 [US1] Add edit/deactivate actions to family detail page in `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx`

### Person Management UI (within Family)

- [ ] T019 [US1] Create `AddPersonToFamilyDialog` component in `app/[locale]/(dashboard)/dashboard/families/_components/add-person-dialog.tsx`
- [ ] T020 [P] [US1] Create `AddPhoneNumberDialog` component in `app/[locale]/(dashboard)/dashboard/families/_components/add-phone-dialog.tsx`
- [ ] T021 [US1] Add person and phone management UI to family detail page `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx`

### Student CRUD UI

- [ ] T022 [US1] Create `CreateStudentDialog` component in `app/[locale]/(dashboard)/dashboard/students/_components/create-student-dialog.tsx`
- [ ] T023 [US1] Add "Ajouter un eleve" button to students list page in `app/[locale]/(dashboard)/dashboard/students/page.tsx` (requires family selection)
- [ ] T024 [P] [US1] Create `EditStudentDialog` component in `app/[locale]/(dashboard)/dashboard/students/_components/edit-student-dialog.tsx`
- [ ] T025 [P] [US1] Create `DeactivateStudentButton` component in `app/[locale]/(dashboard)/dashboard/students/_components/deactivate-student-button.tsx`
- [ ] T026 [US1] Add edit/deactivate actions to student detail page in `app/[locale]/(dashboard)/dashboard/students/[id]/page.tsx`

### i18n for US1

- [ ] T027 [P] [US1] Add all family/person/student form i18n keys in `messages/fr.json` and `messages/en.json`

**Checkpoint**: Families and students can be fully managed (create, edit, deactivate) from the dashboard UI.

---

## Phase 4: User Story 2 — Gestion des periodes, niveaux et classes (Priority: P2)

**Goal**: CRUD pour les periodes scolaires, niveaux et classes periodiques

**Independent Test**: Creer une periode, un niveau, une classe periodique avec capacite — tout via le dashboard

### Period CRUD UI

- [ ] T028 [P] [US2] Create `CreatePeriodDialog` component in `app/[locale]/(dashboard)/dashboard/periods/_components/create-period-dialog.tsx`
- [ ] T029 [P] [US2] Create `EditPeriodDialog` component in `app/[locale]/(dashboard)/dashboard/periods/_components/edit-period-dialog.tsx`
- [ ] T030 [US2] Add create/edit actions to periods list page in `app/[locale]/(dashboard)/dashboard/periods/page.tsx`

### Level CRUD UI

- [ ] T031 [P] [US2] Create `CreateLevelDialog` component in `app/[locale]/(dashboard)/dashboard/levels/_components/create-level-dialog.tsx`
- [ ] T032 [P] [US2] Create `EditLevelDialog` with nextLevel selection in `app/[locale]/(dashboard)/dashboard/levels/_components/edit-level-dialog.tsx`
- [ ] T033 [US2] Create levels list page with promotion chain visualization in `app/[locale]/(dashboard)/dashboard/levels/page.tsx`

### ClassPeriod CRUD UI

- [ ] T034 [P] [US2] Create `CreateClassDialog` component in `app/[locale]/(dashboard)/dashboard/classes/_components/create-class-dialog.tsx`
- [ ] T035 [P] [US2] Create `EditClassDialog` component in `app/[locale]/(dashboard)/dashboard/classes/_components/edit-class-dialog.tsx`
- [ ] T036 [US2] Update classes list page with capacity indicator (places restantes) in `app/[locale]/(dashboard)/dashboard/classes/page.tsx`

### i18n for US2

- [ ] T037 [P] [US2] Add all period/level/class form i18n keys in `messages/fr.json` and `messages/en.json`

**Checkpoint**: Academic structure (periods, levels, classes) can be fully configured from the dashboard UI.

---

## Phase 5: User Story 3 — Inscription des eleves (Priority: P3)

**Goal**: Inscrire un eleve dans une classe, gerer les transitions de statut, reassigner

**Independent Test**: Inscrire un eleve, activer, reassigner vers une autre classe, annuler — tout via le dashboard

### Plan CRUD UI

- [ ] T038 [P] [US3] Create `CreatePlanDialog` component in `app/[locale]/(dashboard)/dashboard/plans/_components/create-plan-dialog.tsx`
- [ ] T039 [P] [US3] Create `EditPlanDialog` component in `app/[locale]/(dashboard)/dashboard/plans/_components/edit-plan-dialog.tsx`
- [ ] T040 [US3] Add create/edit actions to plans list page in `app/[locale]/(dashboard)/dashboard/plans/page.tsx`

### Enrollment UI

- [ ] T041 [US3] Create `CreateEnrollmentDialog` component (student + class + plan selection) in `app/[locale]/(dashboard)/dashboard/enrollments/_components/create-enrollment-dialog.tsx`
- [ ] T042 [US3] Add "Nouvelle inscription" button to enrollments list page in `app/[locale]/(dashboard)/dashboard/enrollments/page.tsx`
- [ ] T043 [US3] Create enrollment status transition buttons (activate, complete, cancel) in `app/[locale]/(dashboard)/dashboard/enrollments/_components/status-actions.tsx`
- [ ] T044 [US3] Create `ReassignClassDialog` component in `app/[locale]/(dashboard)/dashboard/enrollments/_components/reassign-class-dialog.tsx`
- [ ] T045 [P] [US3] Create `ApplyDiscountDialog` component in `app/[locale]/(dashboard)/dashboard/enrollments/_components/apply-discount-dialog.tsx`
- [ ] T046 [US3] Add all enrollment actions (status transitions, reassign, discount) to enrollment detail page in `app/[locale]/(dashboard)/dashboard/enrollments/[id]/page.tsx`

### i18n for US3

- [ ] T047 [P] [US3] Add all plan/enrollment form i18n keys in `messages/fr.json` and `messages/en.json`

**Checkpoint**: Full enrollment lifecycle manageable from the dashboard UI.

---

## Phase 6: User Story 4 — Gestion des paiements (Priority: P4)

**Goal**: Enregistrer des paiements sur une famille avec repartition proportionnelle

**Independent Test**: Enregistrer un paiement sur une famille avec 2 inscriptions, verifier la repartition et le solde

### Payment UI

- [ ] T048 [US4] Create `RecordPaymentDialog` component (amount, method, reference, date) in `app/[locale]/(dashboard)/dashboard/payments/_components/record-payment-dialog.tsx`
- [ ] T049 [US4] Add "Enregistrer un paiement" button to payments list page in `app/[locale]/(dashboard)/dashboard/payments/page.tsx`
- [ ] T050 [US4] Create payment summary widget (total du, paye, restant) for family detail page in `app/[locale]/(dashboard)/dashboard/families/_components/payment-summary.tsx`
- [ ] T051 [US4] Add payment summary and payment history to family detail page in `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx`

### i18n for US4

- [ ] T052 [P] [US4] Add all payment form i18n keys in `messages/fr.json` and `messages/en.json`

**Checkpoint**: Payments can be recorded with correct distribution. Financial tracking visible on family page.

---

## Phase 7: User Story 6 — Configuration par deploiement (Priority: P6)

**Goal**: Interface de configuration cle/valeur typee

**Independent Test**: Modifier un parametre Config via l'interface, verifier la validation de type

### Config UI

- [ ] T053 [US6] Create config list page with editable values in `app/[locale]/(dashboard)/dashboard/config/page.tsx`
- [ ] T054 [US6] Create `EditConfigDialog` component with type-aware input (text, number, boolean) in `app/[locale]/(dashboard)/dashboard/config/_components/edit-config-dialog.tsx`
- [ ] T055 [P] [US6] Create `CreateConfigDialog` component in `app/[locale]/(dashboard)/dashboard/config/_components/create-config-dialog.tsx`

### i18n for US6

- [ ] T056 [P] [US6] Add all config form i18n keys in `messages/fr.json` and `messages/en.json`

**Checkpoint**: Deployment configuration manageable from the dashboard UI.

---

## Phase 8: Dashboard Home & Polish

**Purpose**: Dashboard home page with stats and final quality pass

- [ ] T057 Create dashboard home page with key stats (families, students, enrollments, payments) in `app/[locale]/(dashboard)/dashboard/page.tsx`
- [ ] T058 [P] Add quick action cards/links on dashboard home (nouvelle famille, nouvelle inscription, enregistrer paiement)
- [ ] T059 Verify all pages are mobile-first responsive (375px) per FR-036
- [ ] T060 Run `pnpm type-check` and fix all TypeScript errors
- [ ] T061 Run `pnpm lint:fix` and fix all Biome errors
- [ ] T062 Verify all i18n keys exist in both fr.json and en.json (no missing translations)
- [ ] T063 Verify toast notifications work consistently on all create/update/delete actions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Layout & Theme)**: No dependencies — start immediately
- **Phase 2 (Shared UI)**: Can run in parallel with Phase 1
- **Phase 3 (US1 - Families)**: Depends on Phase 1 + Phase 2
- **Phase 4 (US2 - Periods/Levels/Classes)**: Depends on Phase 1 + Phase 2, can run in parallel with Phase 3
- **Phase 5 (US3 - Enrollments)**: Depends on Phase 3 (students) + Phase 4 (classes)
- **Phase 6 (US4 - Payments)**: Depends on Phase 5 (enrollments must exist)
- **Phase 7 (US6 - Config)**: Depends on Phase 1 + Phase 2 only, can run in parallel with Phases 3-6
- **Phase 8 (Polish)**: Depends on all previous phases

### User Story Dependencies

```
US1 (P1) ─────────────────────────┐
                                   ├──> US3 (P3) ──> US4 (P4)
US2 (P2) ─────────────────────────┘
US6 (P6) ── independent (after Phase 2)
US5 (P5) ── deferred (needs Stripe + portail famille routes)
```

### Parallel Opportunities

```
Phase 1: T002+T005 parallel (theme + sidebar), T001 first (layout fix)
Phase 2: T008, T009, T010, T011, T012, T013 all parallel
Phase 3: T014+T022 parallel (family form + student form), T019+T020 parallel
Phase 4: T028+T031+T034 parallel (period + level + class create dialogs)
Phase 5: T038+T039 parallel (plan dialogs), T043+T044+T045 parallel
Phase 7: T054+T055 parallel (config dialogs)
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + US1)

1. Complete Phase 1: Layout & Theme fixes
2. Complete Phase 2: Shared UI components
3. Complete Phase 3: US1 — Family & Student CRUD forms
4. **STOP and VALIDATE**: Test full family/student workflow
5. Commit and continue

### Incremental Delivery

1. Layout + Theme + Shared UI → Foundation ready
2. US1 → Family & Student forms → Commit (MVP)
3. US2 → Period/Level/Class forms → Commit
4. US3 → Enrollment forms → Commit
5. US4 → Payment forms → Commit
6. US6 → Config UI → Commit
7. Dashboard Home + Polish → Final commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US5 (Portail famille) is deferred — requires Stripe integration and family portal routes
- All server actions already exist — tasks are UI-only
- All forms should use existing Zod schemas from `src/use-cases/*/schemas.ts` for client-side validation
- Use `useActionState` or `useTransition` for form submission state management
- All dialogs use shadcn/ui components (Dialog, Button, Input, Select, Textarea, Label)
- Toast notifications for all success/error feedback
