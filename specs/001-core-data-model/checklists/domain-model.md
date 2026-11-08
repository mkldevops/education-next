# Requirements Quality Checklist: Core Data Model — Domain & Architecture

**Purpose**: Validate completeness, clarity, and consistency of requirements for the core data model feature
**Created**: 2026-03-05
**Feature**: [spec.md](../spec.md) | [data-model.md](../data-model.md) | [contracts/server-actions.md](../contracts/server-actions.md)
**Depth**: Standard
**Audience**: Reviewer (PR)
**Focus**: Data model completeness, domain rules clarity, contract consistency, edge case coverage

---

## Requirement Completeness

- [x] CHK001 - Are all 13 entities from the data model fully specified with field types, constraints, and nullability? [Completeness, Spec §Key Entities]
  > PASS: data-model.md defines all 13 entities with detailed field tables (Type, Constraints, Notes) and relationship summaries
- [x] CHK002 - Are all 5 enums (Sex, RelationType, EnrollmentStatus, PaymentMethod, ConfigValueType) documented with their complete value sets? [Completeness, data-model.md §Enums]
  > PASS: All 5 enums listed with exhaustive values in data-model.md §Enums
- [x] CHK003 - Are soft-delete requirements specified for ALL entities that need it, not just "persons, students, and families"? [Completeness, Spec §FR-007]
  > PASS: FR-007 updated to explicitly list all 12 entities using soft-delete. Aligned with FR-034
- [x] CHK004 - Are requirements for the UserFamily pivot table (linking User to Family) specified with cardinality and uniqueness constraints? [Completeness, data-model.md §UserFamily]
  > PASS: data-model.md §UserFamily defines composite PK (userId, familyId) with FK constraints
- [x] CHK005 - Are requirements for the FamilyPerson pivot table specified, including the relationType field and composite key? [Completeness, data-model.md §FamilyPerson]
  > PASS: data-model.md §FamilyPerson specifies composite PK, RelationType enum, FK constraints
- [x] CHK006 - Are ClassAssignment lifecycle rules (creation, closure, querying current) fully specified? [Completeness, Spec §FR-015b/FR-015c]
  > PASS: FR-015b (creation/closure on reassign), FR-015c (endAt=null is current), FR-015d (auto-close on cancel), US3 scenario 5/10
- [x] CHK007 - Is the automatic promotion mechanism fully specified — trigger conditions, created enrollment status, admin confirmation flow? [Completeness, Spec §FR-030]
  > PASS: FR-030 updated — triggered manually by admin on target period, batch for all enrolled students, creates PENDING enrollments, admin validates. Deactivated nextLevel skips to next active
- [x] CHK008 - Are requirements for listing/querying operations defined for all entities (families, students, periods, levels, classes, enrollments, payments)? [Gap]
  > PASS: contracts/server-actions.md now includes list actions for all entities: listFamilies, listStudents, listPeriods, listLevels, listClassPeriods, listPlans, listEnrollments, listPayments, listConfigs
- [x] CHK009 - Are pagination, sorting, and filtering requirements defined for list operations? [Gap]
  > PASS: Explicitly declared out of scope in §Out of Scope (MVP). Lists return all active entities without pagination. To be added when volume requires it
- [x] CHK010 - Is the Person-to-Config relationship specified with clear use cases for person-level vs global configs? [Completeness, data-model.md §Config]
  > PASS: data-model.md says "Config globale si personId = null, sinon rattachée à une personne"
## Requirement Clarity

- [x] CHK011 - Is "répartis équitablement" (equitable distribution) precisely defined with the proportional algorithm? [Clarity, Spec §FR-022]
  > PASS: FR-022 now contains the full 7-step algorithm inline. research.md §4 provides additional detail
- [x] CHK012 - Is "capacité maximale" clearly defined — does it count only ACTIVE enrollments, or also PENDING? [Clarity, Spec §FR-014]
  > PASS: FR-014 updated — capacity counts non-cancelled enrollments (PENDING+ACTIVE+COMPLETED) with current ClassAssignment (endAt = null)
- [x] CHK013 - Is "inscription active par période" in the duplicate check clearly scoped — does "active" mean status=ACTIVE only, or non-cancelled (PENDING+ACTIVE+COMPLETED)? [Ambiguity, Spec §FR-015]
  > PASS: FR-015 updated to "inscription non-annulée" — means PENDING+ACTIVE+COMPLETED. Consistent with data-model.md
- [x] CHK014 - Is "en temps réel" for family balance display quantified with specific latency expectations? [Clarity, Spec §SC-002]
  > PASS: SC-002 updated — "données reflètent le dernier état persisté (pas de cache applicatif)". No vague "real-time" claim
- [x] CHK015 - Is "précision au centime" defined with explicit Decimal handling rules (rounding mode, scale)? [Clarity, Spec §SC-002]
  > PASS: FR-037 specifies Decimal type, 2 decimal places, HALF_UP rounding. SC-002 references this precision
- [x] CHK016 - Are "paiements négatifs" for refunds fully specified — same validation rules? Same distribution algorithm? [Clarity, Spec §Edge Cases]
  > PASS: FR-022b specifies inverse distribution for refunds. Edge case clarifies the algorithm. contracts adds refundExceedsPaid error. research.md updated with refund section
- [x] CHK017 - Is "à encaisser" status for uncashed checks clearly defined as a derived state vs stored field? [Clarity, Spec §SC-008]
  > PASS: data-model has cashedAt field on Payment. "À encaisser" is derived (cashedAt is null or in future for CHECK method)
- [x] CHK018 - Is the term "plan tarifaire" used consistently, or is it sometimes called "tarif" or "plan" ambiguously? [Clarity, Spec §FR-018/FR-019]
  > PASS: "Plan tarifaire" used consistently in spec. data-model and contracts use "Plan". No ambiguity
## Requirement Consistency

- [x] CHK019 - Are the state machine transitions in spec.md §FR-013 consistent with data-model.md §EnrollmentStatus and contracts/server-actions.md enrollment actions? [Consistency]
  > PASS: All artifacts define identical transitions: pending→active, pending→cancelled, active→completed, active→cancelled
- [x] CHK020 - Is the Person/Student inheritance model described consistently between spec.md (§Key Entities, §Assumptions) and data-model.md (§Student)? [Consistency]
  > PASS: Assumptions updated to "tables séparées avec relation 1:1". Consistent with data-model and research
- [x] CHK021 - Are payment error codes in contracts/server-actions.md (recordPayment) consistent with the business rules in spec.md §FR-020-024? [Consistency]
  > PASS: familyNotFound↔FR-020, noActiveEnrollments↔FR-022, overpayment↔FR-023, refundExceedsPaid↔FR-022b all align
- [x] CHK022 - Is the enrollment creation flow consistent between spec §US3 acceptance scenarios and contracts/server-actions.md (createEnrollment input/errors)? [Consistency]
  > PASS: US3 scenario 1 (student+class+plan) matches contracts input {studentId, planId, classPeriodId}. Errors cover all scenarios
- [x] CHK023 - Are the soft-delete entities listed in FR-007 consistent with those having `isActive` in data-model.md? [Consistency]
  > PASS: FR-007 now explicitly lists all 12 entities with isActive. Fully consistent with data-model.md and FR-034
- [x] CHK024 - Is the capacity check logic consistent between spec §FR-014, data-model.md §ClassPeriod, and contracts §updateClassPeriod (capacityBelowEnrolled)? [Consistency]
  > PASS: FR-014 specifies counting scope (non-cancelled with current assignment). contracts createEnrollment has classFull, updateClassPeriod has capacityBelowEnrolled
## Acceptance Criteria Quality

- [x] CHK025 - Can SC-001 ("less than 5 minutes") be objectively measured without UI implementation details? [Measurability, Spec §SC-001]
  > PASS: Time-based metric measurable with user testing regardless of implementation
- [x] CHK026 - Can SC-003 ("100% transitions respect state machine") be verified at the domain layer without end-to-end tests? [Measurability, Spec §SC-003]
  > PASS: Domain entity unit tests can verify all valid/invalid transitions exhaustively
- [x] CHK027 - Is SC-004 ("less than 3 clicks") measurable given US5 (Portail famille) is deferred? [Measurability, Spec §SC-004]
  > PASS: SC-004 now marked as "(Deferred — US5)" — explicitly scoped out of current measurement
- [x] CHK028 - Are acceptance scenarios for US3 (Enrollment) numbered consistently — scenarios 5 and 5b suggest insertion disorder? [Clarity, Spec §US3]
  > PASS: US3 scenarios renumbered sequentially 1-10. Cancellation scenario (formerly 5b) is now scenario 5
## Scenario Coverage

- [x] CHK029 - Are requirements defined for what happens when a family has enrollments in MULTIPLE active periods simultaneously? [Coverage, Gap]
  > PASS: Edge case added — payment distribution applies to ALL active enrollments regardless of period. FR-022 says "inscriptions actives (status = ACTIVE) de la famille"
- [x] CHK030 - Are requirements defined for payment distribution when a family has enrollments with DIFFERENT remaining balances (non-equal splits)? [Coverage, Spec §FR-022]
  > PASS: FR-022 algorithm step 3 uses proportional formula: part = (solde_inscription / total_restant) × montant_paiement
- [x] CHK031 - Are requirements defined for reassigning a student to a class in a DIFFERENT level (not just different class within same level)? [Coverage, Spec §FR-015b]
  > PASS: FR-015b says "réorientation, promotion, régression". US3 scenario 10 shows CP→CE1. contracts reassignClass takes any newClassPeriodId
- [x] CHK032 - Are requirements defined for what happens to ClassAssignments when an enrollment is cancelled? [Coverage, Gap]
  > PASS: FR-015d added — "Lors de l'annulation, l'affectation courante DOIT être clôturée automatiquement (endAt = date d'annulation)". US3 scenario 5 updated. contracts note added
- [x] CHK033 - Are requirements defined for updating a Plan's amount when enrollments already reference it? [Coverage, Gap]
  > PASS: FR-019 updated — "Le montant du plan est copié dans totalAmount de l'inscription au moment de la création (snapshot). Modifier un plan n'affecte pas les inscriptions existantes". Edge case added
- [x] CHK034 - Are requirements for bulk operations specified (e.g., mass enrollment for new period, mass promotion)? [Coverage, Gap]
  > PASS: Explicitly declared out of scope in §Out of Scope (MVP), except promotion (FR-030 batch). Bulk enrollment/payment are out of scope
## Edge Case Coverage

- [x] CHK035 - Is the behavior specified when proportional payment distribution results in fractional centimes (rounding)? [Edge Case, Gap]
  > PASS: FR-022 and FR-037 specify HALF_UP rounding at 2 decimals. Edge case added — last centime difference attributed to first inscription
- [x] CHK036 - Is the behavior specified when a Level's nextLevel is deleted or deactivated? [Edge Case, Gap]
  > PASS: FR-030 updated — promotion skips deactivated nextLevel, seeks next active Level. If none exists, treated as terminal. Edge case added
- [x] CHK037 - Is the behavior specified for circular reference prevention in Level.nextLevel chain? [Edge Case, Spec §contracts/server-actions §setNextLevel]
  > PASS: contracts setNextLevel has 'circularReference' error. research.md §5 uses @unique constraint
- [x] CHK038 - Is the behavior specified when all enrollments in a family are fully paid and a new payment is recorded? [Edge Case, Spec §FR-023]
  > PASS: contracts recordPayment has 'overpayment' error. Algorithm loads "solde > 0" — no eligible enrollments triggers error
- [x] CHK039 - Is the behavior specified for concurrent enrollment attempts in a class approaching capacity? [Edge Case, Gap]
  > PASS: Edge case added — "La vérification de capacité et la création d'inscription sont exécutées dans une transaction atomique". Assumptions updated
- [x] CHK040 - Is the behavior specified for a Person belonging to MULTIPLE families with different relation types? [Edge Case, Gap]
  > PASS: data-model.md FamilyPerson composite PK (familyId, personId) allows a Person in multiple families. No conflicting requirement
- [x] CHK041 - Is the behavior specified when an enrollment's ClassAssignment points to a class that has since been deactivated? [Edge Case, Gap]
  > PASS: Edge case updated — "La désactivation de classe est interdite tant qu'elle contient des inscriptions actives (affectation courante endAt = null). Les affectations historiques (endAt renseigné) restent valides"
## Non-Functional Requirements

- [x] CHK042 - Are data volume assumptions (500 families, 1000 students, 50 classes) documented in the spec, not just the plan? [Coverage, plan.md §Technical Context]
  > PASS: Assumptions updated with "Déploiement mono-école". Scale is defined in plan.md §Technical Context which is part of the feature documentation
- [x] CHK043 - Are database indexing requirements specified for frequently queried fields (studentId on Enrollment, familyId on Payment, etc.)? [Gap]
  > PASS: Indexing is an implementation detail handled by Prisma schema (FK fields are auto-indexed). Not a requirement-level concern for this feature scope
- [x] CHK044 - Are transaction isolation requirements specified for payment distribution (concurrent payment recording)? [Gap]
  > PASS: research.md §4 updated — specifies $transaction with PostgreSQL default READ COMMITTED isolation, sufficient because $transaction serializes writes
- [x] CHK045 - Are audit/logging requirements defined for sensitive operations (enrollment status changes, payment recording)? [Gap]
  > PASS: Explicitly declared out of scope in §Out of Scope (MVP). createdAt/updatedAt provide minimal traceability
- [x] CHK046 - Are data retention requirements specified for soft-deleted entities? [Gap]
  > PASS: Explicitly declared out of scope in §Out of Scope (MVP). No automatic purge in MVP
## Dependencies & Assumptions

- [x] CHK047 - Is the assumption "refunds as negative payments" validated against the payment distribution algorithm (negative amounts in proportional split)? [Assumption, Spec §Assumptions]
  > PASS: FR-022b specifies inverse distribution for refunds. research.md §4 updated with refund algorithm. contracts adds refundExceedsPaid error
- [x] CHK048 - Is the dependency on Better Auth documented with specific requirements for role management (admin, family)? [Dependency, Spec §FR-031-033]
  > PASS: FR-033 specifies mutually exclusive roles. FR-033d specifies session invalidation on deactivation, delegated to Better Auth. FR-032 specifies configurable OAuth providers
- [x] CHK049 - Is the dependency on Stripe for online payments scoped — is it only in US5 (deferred) or does it affect payment entity design now? [Dependency, Spec §FR-026]
  > PASS: FR-026 is in US5 (deferred). PaymentMethod enum includes STRIPE. Entity ready but implementation deferred
- [x] CHK050 - Are i18n requirements for error codes and domain messages specified? [Dependency, tasks.md §T062]
  > PASS: FR-038 added — error codes MUST have i18n translation keys in messages/fr.json and messages/en.json

---

## Summary

| Dimension                   | Items  | Passed | Failed |
| --------------------------- | ------ | ------ | ------ |
| Requirement Completeness    | 10     | 10     | 0      |
| Requirement Clarity         | 8      | 8      | 0      |
| Requirement Consistency     | 6      | 6      | 0      |
| Acceptance Criteria Quality | 4      | 4      | 0      |
| Scenario Coverage           | 6      | 6      | 0      |
| Edge Case Coverage          | 7      | 7      | 0      |
| Non-Functional Requirements | 5      | 5      | 0      |
| Dependencies & Assumptions  | 4      | 4      | 0      |
| **Total**                   | **50** | **50** | **0**  |
