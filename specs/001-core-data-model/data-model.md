# Data Model: Core Data Model — Enrollment Management

**Feature**: 001-core-data-model
**Date**: 2026-03-05
**Source**: MCD (mcd.png) + spec.md + clarifications

## Enums

### Sex
`MALE` | `FEMALE`

### RelationType
`PARENT` | `TUTOR` | `GRANDPARENT` | `SIBLING` | `OTHER`

### EnrollmentStatus
`PENDING` | `ACTIVE` | `COMPLETED` | `CANCELLED`

State machine transitions:
```
PENDING → ACTIVE
PENDING → CANCELLED
ACTIVE → COMPLETED
ACTIVE → CANCELLED
```

### PaymentMethod
`CASH` | `CARD` | `TRANSFER` | `CHECK` | `STRIPE`

### ConfigValueType
`TEXT` | `NUMBER` | `BOOLEAN`

## Entities

### User
Compte utilisateur Better Auth étendu avec rôles.

| Field    | Type     | Constraints        | Notes |
|----------|----------|--------------------|-------|
| id       | UUID     | PK, auto-generated |       |
| name     | String   | required, max 50   |       |
| email    | String   | required, unique   |       |
| password | String   | required           | Géré par Better Auth |
| roles    | Json     | required           | `["admin"]` ou `["family"]` |
| isActive | Boolean  | default: true      |       |
| createdAt| DateTime | auto               |       |
| updatedAt| DateTime | auto               |       |

Relations: `families` (N:N via UserFamily), `createdFamilies` (1:N)

### Family

| Field             | Type   | Constraints       |
|-------------------|--------|-------------------|
| id                | UUID   | PK                |
| name              | String | required, max 50  |
| emergencyContact  | String | optional, max 250 |
| authorizedPickup  | Text   | optional          |
| createdById       | UUID   | FK → User         |
| isActive          | Boolean| default: true     |
| createdAt         | DateTime| auto             |
| updatedAt         | DateTime| auto             |

Relations: `createdBy` (N:1 User), `users` (N:N via UserFamily), `persons` (N:N via FamilyPerson), `payments` (1:N)

### UserFamily (pivot)

| Field    | Type | Constraints   |
|----------|------|---------------|
| userId   | UUID | FK → User, PK |
| familyId | UUID | FK → Family, PK |

### Person

| Field     | Type     | Constraints            |
|-----------|----------|------------------------|
| id        | UUID     | PK                     |
| name      | String   | required, max 250      |
| lastname  | String   | required, max 250      |
| sex       | Sex      | enum, required         |
| email     | String   | optional, max 250      |
| address   | String   | optional, max 250      |
| postCode  | String   | optional, max 10       |
| city      | String   | optional, max 250      |
| isActive  | Boolean  | default: true          |
| createdAt | DateTime | auto                   |
| updatedAt | DateTime | auto                   |

Relations: `phoneNumbers` (1:N), `configs` (1:N), `families` (N:N via FamilyPerson), `student` (1:1 optional)

### FamilyPerson (pivot avec type de relation)

| Field        | Type         | Constraints        |
|--------------|--------------|---------------------|
| familyId     | UUID         | FK → Family, PK    |
| personId     | UUID         | FK → Person, PK    |
| relationType | RelationType | enum, required      |

### Student (extends Person via 1:1)

| Field               | Type     | Constraints              |
|---------------------|----------|--------------------------|
| id                  | UUID     | PK                       |
| personId            | UUID     | FK → Person, unique      |
| birthday            | DateTime | required                 |
| birthplace          | String   | optional, max 250        |
| previousSchool      | String   | optional, max 250        |
| healthNotes         | Text     | optional                 |
| languagesAtHome     | Json     | optional, default: []    |
| snackAuthorization  | Boolean  | default: false           |
| allergies           | String   | optional, max 250        |
| isActive            | Boolean  | default: true            |
| createdAt           | DateTime | auto                     |
| updatedAt           | DateTime | auto                     |

Relations: `person` (1:1 Person), `enrollments` (1:N)

### PhoneNumber

| Field       | Type   | Constraints        |
|-------------|--------|--------------------|
| id          | UUID   | PK                 |
| personId    | UUID   | FK → Person        |
| phoneNumber | String | required, max 20   |
| channels    | Json   | default: []        |
| isActive    | Boolean| default: true      |
| createdAt   | DateTime| auto              |
| updatedAt   | DateTime| auto              |

Channels: `["sms", "whatsapp", "call"]`

### Config

| Field     | Type           | Constraints       |
|-----------|----------------|--------------------|
| id        | UUID           | PK                 |
| name      | String         | required, max 250  |
| value     | Text           | required           |
| valueType | ConfigValueType| enum, required     |
| personId  | UUID           | FK → Person, optional |
| isActive  | Boolean        | default: true      |
| createdAt | DateTime       | auto               |
| updatedAt | DateTime       | auto               |

Config globale si `personId = null`, sinon rattachée à une personne.

### Level

| Field       | Type   | Constraints              |
|-------------|--------|--------------------------|
| id          | UUID   | PK                       |
| name        | String | required, max 250        |
| nextLevelId | UUID   | FK → Level, optional, unique |
| isActive    | Boolean| default: true            |
| createdAt   | DateTime| auto                    |
| updatedAt   | DateTime| auto                    |

Relations: `nextLevel` (self-ref optional), `previousLevel` (inverse), `classPeriods` (1:N)

### Period

| Field    | Type     | Constraints           |
|----------|----------|-----------------------|
| id       | UUID     | PK                    |
| name     | String   | required, max 50      |
| startAt  | DateTime | required              |
| endAt    | DateTime | required              |
| isActive | Boolean  | default: true         |
| createdAt| DateTime | auto                  |
| updatedAt| DateTime | auto                  |

Validation: `endAt > startAt`, pas de chevauchement entre périodes actives.

Relations: `classPeriods` (1:N)

### ClassPeriod

| Field    | Type     | Constraints        |
|----------|----------|--------------------|
| id       | UUID     | PK                 |
| name     | String   | required, max 250  |
| capacity | Int      | required, min 1    |
| levelId  | UUID     | FK → Level         |
| periodId | UUID     | FK → Period        |
| isActive | Boolean  | default: true      |
| createdAt| DateTime | auto               |
| updatedAt| DateTime | auto               |

Relations: `level` (N:1), `period` (N:1), `classAssignments` (1:N)

### Enrollment

| Field        | Type             | Constraints          |
|--------------|------------------|----------------------|
| id           | UUID             | PK                   |
| studentId    | UUID             | FK → Student         |
| planId       | UUID             | FK → Plan            |
| status       | EnrollmentStatus | default: PENDING     |
| totalAmount  | Decimal          | required             |
| discount     | Decimal          | default: 0           |
| registeredAt | DateTime         | default: now()       |
| canLeaveAlone| Boolean          | default: false       |
| isActive     | Boolean          | default: true        |
| createdAt    | DateTime         | auto                 |
| updatedAt    | DateTime         | auto                 |

Contrainte unique : un étudiant ne peut avoir qu'une inscription active (non-cancelled) par période (vérifiée via ClassAssignment → ClassPeriod → Period).

Relations: `student` (N:1), `plan` (N:1), `classAssignments` (1:N), `payments` (1:N)

### ClassAssignment

| Field         | Type     | Constraints              |
|---------------|----------|--------------------------|
| id            | UUID     | PK                       |
| enrollmentId  | UUID     | FK → Enrollment          |
| classPeriodId | UUID     | FK → ClassPeriod         |
| startAt       | DateTime | required, default: now() |
| endAt         | DateTime | optional (null = courant)|
| createdAt     | DateTime | auto                     |
| updatedAt     | DateTime | auto                     |

L'affectation courante est celle avec `endAt = null`.

Relations: `enrollment` (N:1), `classPeriod` (N:1)

### Payment

| Field       | Type          | Constraints         |
|-------------|---------------|---------------------|
| id          | UUID          | PK                  |
| familyId    | UUID          | FK → Family         |
| enrollmentId| UUID          | FK → Enrollment     |
| amount      | Decimal       | required            |
| method      | PaymentMethod | enum, required      |
| reference   | String        | optional, max 250   |
| paidAt      | DateTime      | required            |
| cashedAt    | DateTime      | optional            |
| isActive    | Boolean       | default: true       |
| createdAt   | DateTime      | auto                |
| updatedAt   | DateTime      | auto                |

Relations: `family` (N:1), `enrollment` (N:1)

### Plan

| Field    | Type    | Constraints       |
|----------|---------|-------------------|
| id       | UUID    | PK                |
| name     | String  | required, max 50  |
| amount   | Decimal | required          |
| isActive | Boolean | default: true     |
| createdAt| DateTime| auto              |
| updatedAt| DateTime| auto              |

Relations: `enrollments` (1:N)

## Entity Relationship Summary

```
User ──N:N──> Family (via UserFamily)
User ──1:N──> Family (createdBy)
Family ──N:N──> Person (via FamilyPerson + relationType)
Person ──1:1──> Student (optional, héritage)
Person ──1:N──> PhoneNumber
Person ──1:N──> Config
Level ──1:1──> Level (nextLevel, optional, self-ref)
Level ──1:N──> ClassPeriod
Period ──1:N──> ClassPeriod
Student ──1:N──> Enrollment
Plan ──1:N──> Enrollment
Enrollment ──1:N──> ClassAssignment
ClassPeriod ──1:N──> ClassAssignment
Family ──1:N──> Payment
Enrollment ──1:N──> Payment
```
