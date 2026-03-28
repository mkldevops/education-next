# Tasks — Education App Review & Improvements

## Completed (all sessions)

- [x] Login page: duplicate "Don't have an account?" (was in both page.tsx and LoginForm)
- [x] Register page: duplicate "Already have an account?" (same pattern)
- [x] `record-payment.ts`: broke clean architecture by using `db` directly — refactored to use gateways
- [x] `config-gateway.ts`: redundant `as ConfigValueType` cast removed
- [x] Multiple gateway type errors (string → enum types for Sex, RelationType, PaymentMethod, ConfigValueType)
- [x] Priority 1 — Branding: translations (fr.json, en.json) updated, hero/navbar/footer use translations, no PeakLab content
- [x] Priority 2 — Server Actions: all 9 action files created and wired to use-cases
- [x] Priority 3 — Admin Dashboard UI: all pages created (families, students, periods, levels, classes, enrollments, payments, plans, config, users, sidebar)
- [x] Priority 4 — Code Quality: personGateway/studentGateway properly typed with Prisma types, list use-cases exist, error.tsx/not-found.tsx/loading.tsx exist for all routes, seed.ts exists
- [x] Priority 5 — Translation Cleanup: unused keys (blog, glossary, social) removed, dashboard translations complete
- [x] Priority 6 — Testing: all use-case tests exist with spy pattern (activate, cancel, complete, apply-discount, reassign-class, create-family, update-family, add-person, deactivate-family, create-enrollment, record-payment, create-student, update-student, deactivate-student, create-level, set-next-level, create-period, update-period, create-class-period, update-class-period, create-plan, update-plan, get-config, set-config)
- [x] `prisma-profile-gateway.ts`: typed PrismaLike.update properly (no more Record<string, unknown>)
- [x] `students/[id]`: added missing loading.tsx skeleton

---

## Open

### Lint Warnings (135 warnings, non-blocking)

- [ ] Test files in `src/use-cases/**/*.test.ts` use `as unknown as any` casts — replace with typed spy interfaces or `vi.fn()` alternatives
- [ ] `noExplicitAny` warnings throughout test suite — all warnings, pre-commit hook only blocks errors

- [x] `enrollments/[id]`: created detail page with status actions, pricing summary, class assignments, payments + loading.tsx

### Potential improvements

- [ ] `dashboard/page.tsx` uses `db` directly instead of going through use-cases — minor clean arch violation
- [ ] Add DB seeding docs to README
