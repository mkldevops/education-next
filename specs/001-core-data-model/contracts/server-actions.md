# Server Actions Contract: Core Data Model

Ce feature ne définit pas d'API REST mais des **Server Actions** (Next.js `"use server"`).
Chaque action retourne `'OK'` ou un code d'erreur typé (Result type pattern).

## Authorization

| Role   | Mutations                                    | Reads                                                        |
| ------ | -------------------------------------------- | ------------------------------------------------------------ |
| admin  | Toutes les actions de mutation               | Toutes les données (toutes les familles)                     |
| family | Aucune (sauf paiement Stripe — US5 deferred) | Uniquement sa famille liée (élèves, inscriptions, paiements) |

Toutes les actions DOIVENT vérifier l'authentification. Les actions non autorisées retournent `'unauthorized'`.

## Family Actions

| Action              | Auth         | Input                                                                             | Output     | Errors                                 |
| ------------------- | ------------ | --------------------------------------------------------------------------------- | ---------- | -------------------------------------- |
| `createFamily`      | admin        | `{ name, emergencyContactName?, emergencyContactPhone?, authorizedPickup? }`      | `'OK'`     | `'validationError'`                    |
| `updateFamily`      | admin        | `{ id, name?, emergencyContactName?, emergencyContactPhone?, authorizedPickup? }` | `'OK'`     | `'notFound'`, `'validationError'`      |
| `deactivateFamily`  | admin        | `{ id }`                                                                          | `'OK'`     | `'notFound'`, `'hasActiveEnrollments'` |
| `addPersonToFamily` | admin        | `{ familyId, person: PersonInput, relationType }`                                 | `'OK'`     | `'notFound'`, `'validationError'`      |
| `linkUserToFamily`  | admin        | `{ userId, familyId }`                                                            | `'OK'`     | `'notFound'`, `'alreadyLinked'`        |
| `listFamilies`      | admin/family | `{}`                                                                              | `Family[]` | —                                      |

Note: `listFamilies` retourne toutes les familles pour admin, uniquement la famille liée pour family.

## Student Actions

| Action              | Auth         | Input                                                      | Output      | Errors                                  |
| ------------------- | ------------ | ---------------------------------------------------------- | ----------- | --------------------------------------- |
| `createStudent`     | admin        | `{ familyId, person: PersonInput, student: StudentInput }` | `'OK'`      | `'familyNotFound'`, `'validationError'` |
| `updateStudent`     | admin        | `{ id, ...StudentInput }`                                  | `'OK'`      | `'notFound'`, `'validationError'`       |
| `deactivateStudent` | admin        | `{ id }`                                                   | `'OK'`      | `'notFound'`, `'hasActiveEnrollments'`  |
| `listStudents`      | admin/family | `{ familyId? }`                                            | `Student[]` | —                                       |

Note: `listStudents` sans familyId retourne tous les élèves pour admin. Le rôle family DOIT fournir familyId (sa propre famille).

## Period Actions

| Action         | Auth         | Input                             | Output     | Errors                                     |
| -------------- | ------------ | --------------------------------- | ---------- | ------------------------------------------ |
| `createPeriod` | admin        | `{ name, startAt, endAt }`        | `'OK'`     | `'validationError'`, `'overlappingPeriod'` |
| `updatePeriod` | admin        | `{ id, name?, startAt?, endAt? }` | `'OK'`     | `'notFound'`, `'overlappingPeriod'`        |
| `listPeriods`  | admin/family | `{}`                              | `Period[]` | —                                          |

## Level Actions

| Action         | Auth         | Input                      | Output    | Errors                              |
| -------------- | ------------ | -------------------------- | --------- | ----------------------------------- |
| `createLevel`  | admin        | `{ name }`                 | `'OK'`    | `'validationError'`                 |
| `updateLevel`  | admin        | `{ id, name? }`            | `'OK'`    | `'notFound'`                        |
| `setNextLevel` | admin        | `{ levelId, nextLevelId }` | `'OK'`    | `'notFound'`, `'circularReference'` |
| `listLevels`   | admin/family | `{}`                       | `Level[]` | —                                   |

## ClassPeriod Actions

| Action              | Auth         | Input                                   | Output          | Errors                                                     |
| ------------------- | ------------ | --------------------------------------- | --------------- | ---------------------------------------------------------- |
| `createClassPeriod` | admin        | `{ name, capacity, levelId, periodId }` | `'OK'`          | `'validationError'`, `'levelNotFound'`, `'periodNotFound'` |
| `updateClassPeriod` | admin        | `{ id, name?, capacity? }`              | `'OK'`          | `'notFound'`, `'capacityBelowEnrolled'`                    |
| `listClassPeriods`  | admin/family | `{ periodId? }`                         | `ClassPeriod[]` | —                                                          |

## Plan Actions

| Action       | Auth         | Input                    | Output   | Errors              |
| ------------ | ------------ | ------------------------ | -------- | ------------------- |
| `createPlan` | admin        | `{ name, amount }`       | `'OK'`   | `'validationError'` |
| `updatePlan` | admin        | `{ id, name?, amount? }` | `'OK'`   | `'notFound'`        |
| `listPlans`  | admin/family | `{}`                     | `Plan[]` | —                   |

## Enrollment Actions

| Action               | Auth         | Input                                             | Output         | Errors                                                                            |
| -------------------- | ------------ | ------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `createEnrollment`   | admin        | `{ studentId, planId, classPeriodId, discount? }` | `'OK'`         | `'studentNotFound'`, `'planNotFound'`, `'classFull'`, `'alreadyEnrolledInPeriod'` |
| `activateEnrollment` | admin        | `{ id }`                                          | `'OK'`         | `'notFound'`, `'invalidStatusTransition'`                                         |
| `completeEnrollment` | admin        | `{ id }`                                          | `'OK'`         | `'notFound'`, `'invalidStatusTransition'`                                         |
| `cancelEnrollment`   | admin        | `{ id }`                                          | `'OK'`         | `'notFound'`, `'invalidStatusTransition'`                                         |
| `reassignClass`      | admin        | `{ enrollmentId, newClassPeriodId }`              | `'OK'`         | `'notFound'`, `'classFull'`, `'enrollmentNotActive'`                              |
| `applyDiscount`      | admin        | `{ id, discount }`                                | `'OK'`         | `'notFound'`, `'discountExceedsTotal'`                                            |
| `listEnrollments`    | admin/family | `{ studentId?, familyId? }`                       | `Enrollment[]` | —                                                                                 |

Note: `cancelEnrollment` clôture automatiquement l'affectation courante (ClassAssignment.endAt = now).

## Payment Actions

| Action          | Auth         | Input                                                 | Output      | Errors                                                                              |
| --------------- | ------------ | ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `recordPayment` | admin        | `{ familyId, amount, method, reference?, cashedAt? }` | `'OK'`      | `'familyNotFound'`, `'noActiveEnrollments'`, `'overpayment'`, `'refundExceedsPaid'` |
| `listPayments`  | admin/family | `{ familyId }`                                        | `Payment[]` | —                                                                                   |

Note: `amount` peut être négatif pour un remboursement. L'erreur `refundExceedsPaid` est retournée si le remboursement rendrait le total payé d'une inscription négatif.

## Config Actions

| Action        | Auth         | Input                        | Output        | Errors                                |
| ------------- | ------------ | ---------------------------- | ------------- | ------------------------------------- |
| `setConfig`   | admin        | `{ name, value, valueType }` | `'OK'`        | `'validationError'`, `'typeMismatch'` |
| `getConfig`   | admin/family | `{ name }`                   | `ConfigValue` | `'notFound'`                          |
| `listConfigs` | admin        | `{}`                         | `Config[]`    | —                                     |
