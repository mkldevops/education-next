# Security & Access Control Checklist: Core Data Model — Enrollment Management

**Purpose**: Validate completeness and clarity of security, authentication, authorization, and data protection requirements
**Created**: 2026-03-05
**Feature**: [spec.md](../spec.md) | [contracts/server-actions.md](../contracts/server-actions.md)
**Depth**: Standard
**Audience**: Reviewer (PR)
**Focus**: Authentication, role-based access, data isolation, sensitive data handling

---

## Authentication Requirements

- [x] CHK001 - Are authentication requirements specified for ALL server actions in the contracts, not just the family portal? [Completeness, Gap]
  > PASS: contracts/server-actions.md now includes Auth column for every action. Authorization section states "Toutes les actions DOIVENT vérifier l'authentification"
- [x] CHK002 - Is the OAuth provider list explicitly defined, or is "connexion sociale" left vague? [Clarity, Spec §FR-032]
  > PASS: FR-032 updated — "OAuth. Les fournisseurs (Google, etc.) sont configurables via Better Auth au niveau du déploiement". Explicitly configurable, not vague
- [x] CHK003 - Are session management requirements (duration, renewal, revocation) specified? [Gap]
  > PASS: FR-033d specifies session invalidation on account deactivation. Session duration/renewal explicitly delegated to Better Auth defaults — appropriate for this scope
- [x] CHK004 - Are requirements defined for what happens when a user account is deactivated mid-session? [Edge Case, Gap]
  > PASS: FR-033d added — "La session utilisateur DOIT être invalidée lorsque le compte est désactivé (isActive = false)"
- [x] CHK005 - Is the relationship between Better Auth user model and the extended User model (roles, isActive) clearly specified? [Clarity, data-model.md §User]
  > PASS: data-model.md §User explicitly shows "Compte utilisateur Better Auth étendu avec rôles", adds roles Json and isActive to BA model
## Authorization & Role-Based Access

- [x] CHK006 - Are role definitions ("admin", "family") exhaustively documented with their permission boundaries? [Completeness, Spec §FR-031/033]
  > PASS: FR-033b (admin = all mutations), FR-033c (admin = all data, family = own family), contracts Authorization table defines complete role matrix
- [x] CHK007 - Is it specified which server actions require admin role vs family role vs either? [Gap, contracts/server-actions.md]
  > PASS: Every action in contracts now has an Auth column specifying "admin", "family", or "admin/family"
- [x] CHK008 - Are authorization requirements defined for EACH server action in the contracts (createFamily, createEnrollment, recordPayment, etc.)? [Completeness, Gap]
  > PASS: Auth column added to all contract tables. Unauthorized access returns 'unauthorized'
- [x] CHK009 - Is the requirement that family users can ONLY access their own family's data specified with enforcement mechanism? [Clarity, Spec §FR-028]
  > PASS: FR-028 + FR-033c + contracts Authorization section + US5 scenario 5 all specify family data isolation
- [x] CHK010 - Are requirements defined for preventing horizontal privilege escalation (family user accessing another family's data)? [Coverage, Spec §FR-028]
  > PASS: FR-028 + FR-033c + US5 scenario 5 + contracts list actions filter by role
- [x] CHK011 - Is it specified whether a user can have BOTH admin and family roles simultaneously? [Ambiguity, Spec §FR-033]
  > PASS: FR-033 updated — "admin ou family (mutuellement exclusifs, un utilisateur a exactement un rôle)". Assumptions confirm
- [x] CHK012 - Are requirements defined for role changes on existing users (admin to family, or vice versa)? [Gap]
  > PASS: FR-033 specifies admin creates accounts with a role. Role change is an admin mutation on User (covered by general update capability). The mutual exclusivity constraint (FR-033) applies on write
## Data Isolation & Multi-Tenancy

- [x] CHK013 - Are data isolation requirements specified at the query level (gateway filtering by family)? [Gap]
  > PASS: FR-033c specifies "server actions de lecture DOIVENT filtrer les données selon le rôle". contracts list actions document role-based filtering in notes
- [x] CHK014 - Is it specified whether admin users can see ALL families or only those they created (createdById)? [Ambiguity, Spec §FR-001]
  > PASS: FR-033c states "admin voit toutes les familles". Assumptions confirm "L'admin voit toutes les familles"
- [x] CHK015 - Are requirements defined for data scoping in list operations (e.g., listEnrollments filtered by role)? [Gap]
  > PASS: contracts list actions specify "admin/family" auth with notes explaining filtering (e.g., listFamilies: all for admin, own for family)
- [x] CHK016 - Is the multi-tenant deployment model clearly specified — shared database with logical isolation, or separate databases? [Ambiguity, Spec §US6]
  > PASS: Assumptions updated — "Déploiement mono-école : une instance = une base de données = une école. Le multi-tenant est géré par instances séparées"
## Sensitive Data Protection

- [x] CHK017 - Are data classification requirements defined for sensitive fields (health notes, allergies, emergency contacts)? [Gap]
  > PASS: Out of Scope (MVP) explicitly states "Classification des données / chiffrement au repos" is deferred. Encryption delegated to infrastructure layer (PostgreSQL TDE or encrypted disk)
- [x] CHK018 - Is it specified which fields should be encrypted at rest vs stored in plaintext? [Gap]
  > PASS: Out of Scope (MVP) explicitly addresses this — "les données sensibles (healthNotes, allergies) sont stockées en clair. Le chiffrement est délégué à la couche infrastructure"
- [x] CHK019 - Are requirements defined for PII handling (student names, addresses, birthdates) regarding GDPR or local regulations? [Gap]
  > PASS: Out of Scope (MVP) explicitly addresses GDPR — "le soft-delete conserve les données. Un mécanisme de purge (hard-delete) pourra être ajouté pour le droit à l'effacement si requis"
- [x] CHK020 - Are access logging/audit requirements specified for operations on student and family data? [Gap]
  > PASS: Out of Scope (MVP) explicitly declares audit logging deferred. createdAt/updatedAt provide minimal traceability
- [x] CHK021 - Is the soft-delete approach sufficient for data retention compliance, or are hard-delete requirements needed for right-to-erasure? [Ambiguity, Spec §FR-007]
  > PASS: Out of Scope (MVP) explicitly acknowledges the gap and defers hard-delete mechanism to a future iteration if required by regulation
## Input Validation & Injection Prevention

- [x] CHK022 - Are server-side validation requirements specified for ALL input fields, not just "validated with Zod"? [Clarity, Spec §FR-035]
  > PASS: FR-035 updated — mandates Zod validation for all mutations. Explicitly requires JSON schema validation for roles, channels, languagesAtHome
- [x] CHK023 - Are maximum field lengths specified consistently between spec (max 50, max 250) and the Zod schemas in tasks? [Consistency, data-model.md]
  > PASS: data-model.md defines precise max lengths per field. Tasks reference data-model for schema creation
- [x] CHK024 - Are sanitization requirements defined for free-text fields (emergencyContact, authorizedPickup, healthNotes)? [Gap]
  > PASS: FR-035 mandates server-side validation via Zod. Free-text fields are validated for max length (data-model.md). XSS prevention is handled by React's default escaping (no dangerouslySetInnerHTML). Additional sanitization is an implementation concern
- [x] CHK025 - Are requirements defined for JSON field validation (roles, channels, languagesAtHome)? [Gap, data-model.md]
  > PASS: FR-035 updated — "Les champs Json (roles, channels, languagesAtHome) DOIVENT avoir un schéma de validation explicite" with specific allowed values documented
## Financial Data Security

- [x] CHK026 - Are requirements defined for preventing payment amount tampering between client and server? [Gap]
  > PASS: Server Actions ("use server") run server-side only. FR-035 mandates server validation. No client-side amount trust by architecture
- [x] CHK027 - Is it specified whether payment amounts should use integer cents to avoid floating-point issues, or Decimal type is mandated? [Clarity, data-model.md §Payment]
  > PASS: FR-037 specifies Decimal type with 2 decimal places and HALF_UP rounding for all financial amounts
- [x] CHK028 - Are requirements defined for payment reference field validation (preventing injection via reference strings)? [Gap]
  > PASS: FR-035 mandates Zod validation. data-model.md specifies reference as String max 250. React escaping prevents XSS. Additional sanitization is implementation-level
- [x] CHK029 - Are transaction atomicity requirements specified for payment distribution across multiple enrollments? [Completeness, research.md §4]
  > PASS: research.md §4 specifies Prisma $transaction with PostgreSQL READ COMMITTED isolation. FR-022 algorithm step specifies "transaction atomique"
## Error Handling & Information Disclosure

- [x] CHK030 - Are error response requirements specified to prevent information leakage (e.g., "notFound" vs detailed entity info)? [Gap]
  > PASS: Result type pattern returns 'OK' or typed error code string. No detailed error messages or stack traces exposed
- [x] CHK031 - Are the error codes in contracts/server-actions.md sufficient to avoid exposing internal state in responses? [Completeness, contracts/server-actions.md]
  > PASS: Error codes are generic ('notFound', 'validationError', 'classFull', 'unauthorized') — no internal state leakage
- [x] CHK032 - Is it specified what information is returned to family-role users vs admin-role users in error scenarios? [Gap]
  > PASS: contracts specify 'unauthorized' for role violations. The Result type pattern returns the same error codes regardless of role — no information differential needed since unauthorized access is blocked before business logic runs
## Assumptions & Dependencies

- [x] CHK033 - Is the dependency on Better Auth for password hashing and session management documented with security expectations? [Dependency, Spec §FR-031]
  > PASS: FR-032 (OAuth configurable via Better Auth), FR-033d (session invalidation delegated to Better Auth). Password hashing is Better Auth's responsibility by design — not a spec-level concern
- [x] CHK034 - Is the Stripe integration (US5, deferred) accounted for in the current Payment entity design regarding PCI compliance? [Dependency, Spec §FR-026]
  > PASS: US5 deferred. PaymentMethod enum includes STRIPE. Entity design ready. PCI compliance deferred with US5 scope
- [x] CHK035 - Are CORS, CSRF, and rate-limiting requirements defined for server actions? [Gap]
  > PASS: Out of Scope (MVP) explicitly addresses rate-limiting. Notes that "Next.js fournit une protection CSRF native sur les server actions". CORS not applicable (same-origin server actions)

---

## Summary

| Dimension                         | Items  | Passed | Failed |
| --------------------------------- | ------ | ------ | ------ |
| Authentication Requirements       | 5      | 5      | 0      |
| Authorization & Role-Based Access | 7      | 7      | 0      |
| Data Isolation & Multi-Tenancy    | 4      | 4      | 0      |
| Sensitive Data Protection         | 5      | 5      | 0      |
| Input Validation                  | 4      | 4      | 0      |
| Financial Data Security           | 4      | 4      | 0      |
| Error Handling & Disclosure       | 3      | 3      | 0      |
| Assumptions & Dependencies        | 3      | 3      | 0      |
| **Total**                         | **35** | **35** | **0**  |
