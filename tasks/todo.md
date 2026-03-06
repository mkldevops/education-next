# Tasks — Education App Review & Improvements

## Bugs Fixed (this session)

- [x] Login page: duplicate "Don't have an account?" (was in both page.tsx and LoginForm)
- [x] Register page: duplicate "Already have an account?" (same pattern)
- [x] `record-payment.ts`: broke clean architecture by using `db` directly — refactored to use gateways
- [x] `config-gateway.ts`: redundant `as ConfigValueType` cast removed
- [x] Multiple gateway type errors (string → enum types for Sex, RelationType, PaymentMethod, ConfigValueType)

---

## Priority 1 — Branding & Content (Template → Education)

The app still shows the generic "PeakLab" digital agency template. Everything below must be adapted for a school enrollment management system.

- [ ] Update `messages/fr.json` and `messages/en.json`: replace all PeakLab references with education app name
- [ ] Update hero section copy: replace "Transform your vision into digital reality" with enrollment-focused messaging
- [ ] Update hero CTAs: "Start a project" → "Accéder au portail" / "Learn more" → contextual
- [ ] Update footer tagline: replace digital agency copy with education-relevant text
- [ ] Update `metadata.title` and `metadata.description` for SEO
- [ ] Update `company.*` fields in translations (name, legalName, address, etc.)
- [ ] Remove irrelevant navbar links: "About" and "Contact" don't apply to an enrollment system
- [ ] Remove irrelevant footer links: blog, glossary references in translations but no routes

## Priority 2 — Missing Server Actions (API boundary)

Use-cases exist but NO server actions connect them to the UI. None of the business logic is callable from the frontend.

- [ ] Create `app/[locale]/(dashboard)/_lib/family-actions.ts` — server actions for createFamily, updateFamily, deactivateFamily, addPersonToFamily, linkUserToFamily
- [ ] Create `app/[locale]/(dashboard)/_lib/student-actions.ts` — server actions for createStudent, updateStudent, deactivateStudent
- [ ] Create `app/[locale]/(dashboard)/_lib/period-actions.ts` — server actions for createPeriod, updatePeriod
- [ ] Create `app/[locale]/(dashboard)/_lib/level-actions.ts` — server actions for createLevel, setNextLevel
- [ ] Create `app/[locale]/(dashboard)/_lib/class-period-actions.ts` — server actions for createClassPeriod, updateClassPeriod
- [ ] Create `app/[locale]/(dashboard)/_lib/enrollment-actions.ts` — server actions for createEnrollment, activateEnrollment, completeEnrollment, cancelEnrollment, reassignClass, applyDiscount
- [ ] Create `app/[locale]/(dashboard)/_lib/payment-actions.ts` — server action for recordPayment
- [ ] Create `app/[locale]/(dashboard)/_lib/plan-actions.ts` — server action for createPlan
- [ ] Create `app/[locale]/(dashboard)/_lib/config-actions.ts` — server actions for setConfig, getConfig

## Priority 3 — Admin Dashboard UI

Currently the dashboard is an empty placeholder. Need admin pages for managing the school data.

- [ ] Create dashboard home page with summary stats (families, students, enrollments, pending payments)
- [ ] Create families list page: `app/[locale]/(dashboard)/families/page.tsx`
- [ ] Create family detail page: `app/[locale]/(dashboard)/families/[id]/page.tsx`
- [ ] Create students list page: `app/[locale]/(dashboard)/students/page.tsx`
- [ ] Create student detail page: `app/[locale]/(dashboard)/students/[id]/page.tsx`
- [ ] Create periods list/manage page: `app/[locale]/(dashboard)/periods/page.tsx`
- [ ] Create levels list/manage page: `app/[locale]/(dashboard)/levels/page.tsx`
- [ ] Create class-periods list page: `app/[locale]/(dashboard)/classes/page.tsx`
- [ ] Create enrollments list page: `app/[locale]/(dashboard)/enrollments/page.tsx`
- [ ] Create enrollment detail page with status management: `app/[locale]/(dashboard)/enrollments/[id]/page.tsx`
- [ ] Create payments page: `app/[locale]/(dashboard)/payments/page.tsx`
- [ ] Create plans configuration page: `app/[locale]/(dashboard)/plans/page.tsx`
- [ ] Create deployment config page: `app/[locale]/(dashboard)/config/page.tsx`
- [ ] Add sidebar navigation for all admin pages

## Priority 4 — Code Quality Issues

- [ ] `personGateway.update` uses `Record<string, unknown>` — type it properly with Prisma's PersonUpdateInput
- [ ] `studentGateway.update` uses `Record<string, unknown>` — same issue
- [ ] Add `listFamilies`, `listStudents`, `listEnrollments` etc. use-cases (currently only gateways have list methods)
- [ ] Missing `not-found.tsx` and `error.tsx` pages for proper error handling
- [ ] Missing `loading.tsx` skeletons for dashboard pages
- [ ] Add DB seed script (`prisma/seed.ts`) with test data for development

## Priority 5 — Translation Cleanup

- [ ] Remove unused translation keys: `navbar.blog`, `navbar.glossary`, `footer.blog`, `footer.glossary`, `footer.social`
- [ ] Add translation keys for dashboard pages (families, students, enrollments, etc.)
- [ ] Add translation keys for form labels (family name, student birthday, etc.)
- [ ] Add translation keys for status labels (PENDING, ACTIVE, COMPLETED, CANCELLED)

## Priority 6 — Testing

- [ ] Add unit tests for domain entities (enrollment state machine, payment distribution, period overlap)
- [ ] Add unit tests for use-cases (createFamily, createEnrollment, recordPayment)
- [ ] Add integration tests for gateway methods
