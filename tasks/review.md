# Review — Post-Swarm Audit

**Date**: 2026-03-06
**Spec**: specs/001-core-data-model/spec.md

## Critical Issues (must fix)

- [ ] REVIEW-001: `cancelEnrollmentAction` passes a raw string `enrollmentId` to `cancelEnrollment()`, but the use-case expects `{ id: string }`. This will cause Zod validation to fail at runtime (`enrollmentIdSchema` expects an object). — File: `app/[locale]/(dashboard)/_lib/enrollment-actions.ts:47` — Spec: FR-013
- [ ] REVIEW-002: `deactivateFamilyAction` passes a raw string `id` to `deactivateFamily()`, but the use-case expects `{ id: string }` (an object with `id` property). This will fail at runtime. — File: `app/[locale]/(dashboard)/_lib/family-actions.ts:36` — Spec: FR-001
- [ ] REVIEW-003: `deactivateStudentAction` passes a raw string `id` to `deactivateStudent()`, but the use-case expects `{ id: string }`. Zod validation will reject the raw string. — File: `app/[locale]/(dashboard)/_lib/student-actions.ts:32` — Spec: FR-007
- [ ] REVIEW-004: All dashboard page `generateMetadata` functions use `getTranslations({ locale, namespace: 'dashboard' })` then call `t('pages.families.title')`, `t('pages.students.title')`, etc. — but no `pages.*` keys exist under the `dashboard` namespace in `messages/fr.json` / `messages/en.json`. This will produce missing translation warnings or empty titles at runtime. Affects 10+ pages. — File: `messages/fr.json`, all dashboard pages — Spec: FR-038
- [ ] REVIEW-005: All dashboard page content uses hardcoded English strings (e.g., `"Families"`, `"Emergency Contact"`, `"Students"`, `"Name"`, `"Birthday"`, etc.) instead of i18n translation keys. The app supports fr/en locales but the dashboard is English-only. This violates the i18n requirement and the app's bilingual nature. — File: ALL dashboard pages under `app/[locale]/(dashboard)/dashboard/` — Spec: FR-036, i18n rules
- [ ] REVIEW-006: `findActiveByFamily` in `enrollment-gateway.ts` filters by `status: { in: ['PENDING', 'ACTIVE'] }`, but FR-022 specifies payment distribution must apply to **ACTIVE-only** enrollments (`status = ACTIVE`). Including PENDING enrollments in payment distribution contradicts the spec. — File: `src/gateways/enrollment-gateway.ts:56` — Spec: FR-022
- [ ] REVIEW-007: `record-payment.ts` does NOT subtract discount when computing `remainingBalance`. Line 27: `remainingBalance: Number(e.totalAmount) - totalPaid` should be `Number(e.totalAmount) - Number(e.discount) - totalPaid`. This will cause incorrect payment distribution — over-allocating to enrollments that have discounts. — File: `src/use-cases/payments/record-payment.ts:27` — Spec: FR-022
- [ ] REVIEW-008: The `enrollment-gateway.ts` `findDuplicate` checks for duplicate by `studentId + planId`, but FR-015 says duplicates should be checked per **period** (one enrollment per student per period), not per plan. A student could enroll with different plans in the same period, which should be blocked but isn't. — File: `src/gateways/enrollment-gateway.ts:37-46`, `src/use-cases/enrollments/create-enrollment.ts:26-29` — Spec: FR-015
- [ ] REVIEW-009: Missing `"unauthorized"` key in the root `errors` namespace of translation files. Server actions return `'unauthorized'` as an error code, but the key only exists under `settings.errors.unauthorized`, not in `errors.unauthorized`. — File: `messages/fr.json`, `messages/en.json` — Spec: FR-038
- [ ] REVIEW-010: `record-payment` use-case creates payments individually in a loop (`for...of`) without wrapping in a database transaction. FR-022 explicitly requires payment distribution to be applied in an **atomic transaction**. A partial failure could leave the database in an inconsistent state. — File: `src/use-cases/payments/record-payment.ts:33-43` — Spec: FR-022

## Important Issues (should fix)

- [ ] REVIEW-011: Most dashboard tables lack `overflow-x-auto` on mobile. Only `payments/page.tsx` has `overflow-x-auto` on its table wrapper. All other tables (`families`, `students`, `periods`, `levels`, `classes`, `enrollments`, `config`, `plans`, and all detail pages) will overflow horizontally on 375px screens. — File: All dashboard list pages — Spec: FR-036
- [ ] REVIEW-012: `StatusBadge` component is duplicated identically in 4 files: `families/[id]/page.tsx`, `students/[id]/page.tsx`, `enrollments/page.tsx`, `enrollments/[id]/page.tsx`. It should be extracted to a shared component in `src/components/` or `src/features/dashboard/`. — Files: 4 dashboard pages
- [ ] REVIEW-013: Enrollment detail page (`enrollments/[id]/page.tsx`) does NOT show state transition buttons (Activate, Complete, Cancel). FR-013 requires the admin to be able to transition enrollment status. The page is read-only — no way to change enrollment status from the UI. — File: `app/[locale]/(dashboard)/dashboard/enrollments/[id]/page.tsx` — Spec: FR-013
- [ ] REVIEW-014: Family detail page enrollments section (line 149) only checks `family.persons[0]?.person.student?.enrollments.length > 0` — this only looks at the FIRST person's enrollments. If the first person isn't a student or has no enrollments but other students do, the section won't render. Should iterate over all students' enrollments. — File: `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx:149` — Spec: FR-005
- [ ] REVIEW-015: Classes page capacity count does not filter by enrollment status. The query `classAssignments: { where: { endAt: null } }` doesn't check that the associated enrollment is non-cancelled. While `cancelEnrollment` closes assignments, edge cases (data fixes, direct DB edits) could lead to wrong counts. The `classPeriodGateway.countEnrolled` correctly filters by status — the page query should match. — File: `app/[locale]/(dashboard)/dashboard/classes/page.tsx:27-29` — Spec: FR-014
- [ ] REVIEW-016: Gateway `list()` functions (`familyGateway.list`, `studentGateway.list`, `enrollmentGateway.list`, `paymentGateway.list`) do NOT filter by `isActive: true`. Per FR-007, default queries should only return active entities. The dashboard pages add `isActive: true` in their direct `db` queries, but the gateway list functions (used by list use-cases) return ALL entities including deactivated ones. — File: `src/gateways/family-gateway.ts:35-37`, `src/gateways/student-gateway.ts:34-38`, `src/gateways/enrollment-gateway.ts:25-29`, `src/gateways/payment-gateway.ts:28-32` — Spec: FR-007
- [ ] REVIEW-017: `createEnrollment` use-case does NOT create the enrollment and class assignment within a single transaction. FR-014 and the edge cases section require capacity check + enrollment creation to be atomic to prevent race conditions. — File: `src/use-cases/enrollments/create-enrollment.ts:36-49` — Spec: FR-014 (edge cases)
- [ ] REVIEW-018: Dashboard pages do NOT check user role. An authenticated family user accessing `/dashboard/families` would see ALL families. FR-033c requires data filtering by role — admin sees all, family sees only their family. No auth check exists on the read pages. — File: All dashboard Server Component pages — Spec: FR-033c
- [ ] REVIEW-019: No empty state UI for any dashboard list page. If there are no families, students, enrollments, etc., the tables render with headers but an empty `<tbody>`. Should show a meaningful empty state message. — File: All dashboard list pages
- [ ] REVIEW-020: `Decimal.toFixed(2)` is called directly on Prisma `Decimal` objects in template literals (e.g., `enrollment.totalAmount.toFixed(2)`). While Prisma Decimal supports `.toFixed()`, mixing `Number()` conversions and direct `.toFixed()` calls is inconsistent and can lead to precision issues. All financial amounts should use consistent handling — convert to `Number` first or use Prisma Decimal's `.toFixed` uniformly. — File: Multiple dashboard pages — Spec: FR-037
- [ ] REVIEW-021: Families page tries to count enrollments from `family.persons[].person.student?.enrollments.length` but the query does NOT include enrollments in the `include`. The `student` relation is included but not its `enrollments`. This will always show 0 or cause a runtime error. — File: `app/[locale]/(dashboard)/dashboard/families/page.tsx:42-44` — Spec: FR-005

## Minor Issues (nice to have)

- [ ] REVIEW-030: `deactivateFamily` use-case does not validate input with Zod (no schema validation). It takes `{ id: string }` raw. FR-035 requires all mutations to be validated with Zod. — File: `src/use-cases/families/deactivate-family.ts` — Spec: FR-035
- [ ] REVIEW-031: `auth-helper.ts` parses `roles` from session as `JSON.parse(session.user.roles || '[]')`. If `roles` is already a parsed JSON value (Better Auth may return it as-is from Prisma's Json type), double-parsing could fail or return wrong results. Should guard with a type check. — File: `app/[locale]/(dashboard)/_lib/auth-helper.ts:10` — Spec: FR-033b
- [ ] REVIEW-032: `requireAdmin` returns `null` on failure instead of a typed error code. This means the server actions return `'unauthorized'` as a separate branch. Consider having `requireAdmin` throw or return a result type for consistency. — File: `app/[locale]/(dashboard)/_lib/auth-helper.ts`
- [ ] REVIEW-033: Sidebar uses `BookOpen` icon for both `classes` and `enrollments` nav items. Should use distinct icons for visual clarity. — File: `src/features/dashboard/sidebar.tsx:27`
- [ ] REVIEW-034: Sidebar bottom nav links to `/settings` but no settings page exists in the dashboard routes (the route would be `app/[locale]/(dashboard)/dashboard/settings/`). This will 404. — File: `src/features/dashboard/sidebar.tsx:34`
- [ ] REVIEW-035: `record-payment` returns `'OK'` instead of the created payment objects. The server action contract suggests returning the created entity. Minor — the action already revalidates. — File: `src/use-cases/payments/record-payment.ts:45`
- [ ] REVIEW-036: Family detail page does not filter persons/students by `isActive`. Deactivated persons and students will still appear in the family detail view. — File: `app/[locale]/(dashboard)/dashboard/families/[id]/page.tsx:27` — Spec: FR-007
- [ ] REVIEW-037: Student detail page does not filter enrollments by `isActive`. — File: `app/[locale]/(dashboard)/dashboard/students/[id]/page.tsx:41` — Spec: FR-007
- [ ] REVIEW-038: `person-gateway.ts` `addPhone` stores `channels` as a plain `string`, but the Prisma schema defines `channels` as `Json`. Should pass a JSON array of channel values, not a string. — File: `src/gateways/person-gateway.ts:30-31` — Spec: FR-003, FR-035
- [ ] REVIEW-039: `payment.ts` domain logic uses basic `Math.round(x * 100) / 100` for rounding. FR-037 specifies HALF_UP rounding. `Math.round` uses "round half to even" (banker's rounding) in some edge cases. Should implement explicit HALF_UP. — File: `src/domain/payment.ts:59` — Spec: FR-037

## Spec Coverage Summary

| Requirement | Status | Notes |
|------------|--------|-------|
| FR-001 | ⚠️ | Family CRUD exists but `deactivateFamilyAction` has arg mismatch bug (REVIEW-002) |
| FR-002 | ✅ | Person-to-family with relation type works |
| FR-003 | ⚠️ | PhoneNumber creation exists but `channels` stored as string not JSON (REVIEW-038) |
| FR-004 | ✅ | `linkUserToFamily` use-case + action exist |
| FR-005 | ✅ | Student created via family, inherits Person fields |
| FR-006 | ✅ | Student model has all required fields |
| FR-007 | ⚠️ | Soft-delete implemented but gateway list functions don't filter by isActive (REVIEW-016) |
| FR-008 | ✅ | Period creation with name, startAt, endAt |
| FR-009 | ❌ | Not verified — no period overlap check found in create-period use-case (need to verify) |
| FR-010 | ✅ | Level with free-form name |
| FR-011 | ✅ | ClassPeriod with level, period, capacity |
| FR-012 | ✅ | Enrollment creation with plan selection + class assignment |
| FR-013 | ⚠️ | State machine implemented correctly in domain, but no UI transition buttons (REVIEW-013), cancelEnrollment action has arg bug (REVIEW-001) |
| FR-014 | ⚠️ | Capacity check exists in use-case but classes page count is missing status filter (REVIEW-015), no transaction (REVIEW-017) |
| FR-015 | ❌ | Duplicate check is by student+plan, not student+period as required (REVIEW-008) |
| FR-015b | ✅ | Reassign class use-case exists |
| FR-015c | ✅ | Current assignment = endAt null, correctly used |
| FR-015d | ✅ | Cancel enrollment closes current assignment |
| FR-016 | ✅ | Apply discount use-case exists |
| FR-017 | ✅ | canLeaveAlone field on enrollment |
| FR-018 | ✅ | Plan creation exists |
| FR-019 | ✅ | totalAmount snapshot from plan at creation time |
| FR-019b | ✅ | List plans use-case exists |
| FR-020 | ✅ | Payment with all methods (CASH, CARD, TRANSFER, CHECK, STRIPE) |
| FR-021 | ✅ | cashedAt field on payment, shown in UI |
| FR-022 | ❌ | Distribution includes PENDING enrollments (should be ACTIVE only), missing discount in balance calc, no transaction (REVIEW-006, 007, 010) |
| FR-022b | ✅ | Refund distribution implemented in domain |
| FR-023 | ✅ | Overpayment check in domain payment logic |
| FR-024 | ✅ | Partial payments supported |
| FR-025–028 | ⏳ | Deferred (US5 — family portal) |
| FR-029 | ✅ | Config entity exists with key/value/type |
| FR-030 | ⏳ | Promotion use-case not yet implemented (likely deferred) |
| FR-030b | ✅ | Level nextLevel relation exists |
| FR-031 | ⚠️ | Auth config exists but email+password signup is enabled (should be admin-created only per spec) |
| FR-032 | ⚠️ | OAuth not configured — only email+password enabled in auth.ts |
| FR-033 | ✅ | User model has roles field |
| FR-033b | ✅ | All mutation server actions call `requireAdmin()` |
| FR-033c | ❌ | Dashboard read pages have NO role-based filtering (REVIEW-018) |
| FR-033d | ⏳ | Session invalidation on deactivation not implemented |
| FR-034 | ✅ | All entities have isActive, createdAt, updatedAt |
| FR-035 | ⚠️ | Most mutations use Zod, but `deactivateFamily` doesn't (REVIEW-030) |
| FR-036 | ❌ | Tables not responsive — no overflow-x-auto on 10+ pages (REVIEW-011) |
| FR-037 | ⚠️ | Decimal(10,2) in schema, but rounding uses Math.round not HALF_UP (REVIEW-039), inconsistent Decimal handling in UI (REVIEW-020) |
| FR-038 | ⚠️ | Error codes exist with i18n keys, but `unauthorized` missing from root errors namespace (REVIEW-009), dashboard page titles use nonexistent keys (REVIEW-004) |
