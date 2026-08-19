# Business rules

What the application actually enforces, and where. Every rule below is a claim about code in this
repository, with the file that owns it. When a rule changes, change it here in the same commit.

Pure rules live in `src/domain/`. Sequencing and persistence guards live in `src/use-cases/`. Input
shapes live in each feature's `schemas.ts`. Nothing in this document is aspirational — where a rule
that ought to exist does not, it is listed under [Known gaps](#known-gaps).

## Vocabulary

| Term | Model | Meaning |
|---|---|---|
| Family | `Family` | The billing unit. Owns people, and every payment is attached to one. |
| Person | `Person` | A human. A parent, a tutor, or the person record behind a student. |
| Student | `Student` | The `Person` who attends. One `Person` maps to at most one `Student`. |
| Period | `Period` | A school year. Dated, and the scope of most dashboard reads. |
| Level | `Level` | A grade (CP, CE1…). Levels chain through `nextLevelId`. |
| Class | `ClassPeriod` | One level taught during one period, with a capacity. |
| Assignment | `ClassAssignment` | A student's seat in a class, `endAt: null` while it holds. |
| Enrollment | `Enrollment` | A student registered on a plan. Carries the money. |
| Plan | `Plan` | A price list entry (Mi-temps, Temps plein…). |
| Payment | `Payment` | Money received, always attached to one enrollment. |

## Roles and scope

Three roles: `SUPER_ADMIN`, `ADMIN`, `PARENT` (`src/types/enums.ts`).

- Every dashboard read resolves the role from the **database**, never from the session payload —
  `getSessionWithRole()` in `app/[locale]/(dashboard)/_lib/auth-helper.ts`.
- `requireAdmin()` admits `ADMIN` and `SUPER_ADMIN`. `requireRole([...])` takes an explicit list.
- `requireFamilyScope()` returns `{ isAdmin: true }` for staff, or `{ isAdmin: false, familyId }`
  for a parent. **A parent with no linked family gets `notFound()`** rather than an unscoped query.
- **The `/dashboard/users` space is open to `ADMIN` and `SUPER_ADMIN`**: both read the user list and
  manage invitations.
- **Every user mutation requires `SUPER_ADMIN`** — role change, profile edit, archiving,
  restoration, permanent deletion, session revocation, password reset, family link and unlink
  (`app/[locale]/(dashboard)/_lib/user-actions.ts`, `requireSuperAdmin()`). An ordinary `ADMIN`
  reads the list and the detail drawer, and manages invitations; the page hides the controls it
  cannot use, and the actions refuse them regardless of what the UI shows.
- A resource outside a parent's family answers `notFound()`, never `forbidden()` — the existence of
  another family's student is not disclosed.

`proxy.ts` protects `/dashboard`, `/settings`, `/profile` coarsely. Its matcher **excludes `/api`**,
so every route handler and Server Action authenticates itself.

## User management

The `/dashboard/users` drawer is the single management surface. Its guards live in
`src/domain/user.ts` and are applied by `src/use-cases/users/`.

- **A super admin never acts on their own account** through this screen — role change, archiving,
  restoration and deletion all answer `cannotTargetSelf`. Self-service stays in `/profile`.
- **The last active `SUPER_ADMIN` is protected.** Demoting or archiving them answers
  `lastSuperAdmin`, counted over active super admins only.
- **Archiving is the reversible action.** `deactivateUser` sets `isActive: false` and deletes every
  session in the same transaction, so the archived user is signed out immediately.
  `reactivateUser` restores them. Archiving an already archived user answers `alreadyInactive`.
- **Permanent deletion is a second, deliberate step.** `deleteUser` refuses an active account
  (`stillActive`) and refuses an account still referenced by history — families created, invitations
  sent, payment transactions initiated (`hasRelatedRecords`). The dialog also requires the target's
  email to be typed back; a mismatch answers `confirmationMismatch`. Sessions, accounts, passkeys
  and family links cascade with the row.
- **Email uniqueness is checked before an update**, including against archived accounts
  (`emailAlreadyUsed`).
- **Passwords are never set by an administrator.** `sendPasswordResetAction` triggers the Better
  Auth reset email; the user chooses their own password. It refuses an archived account.
- **Assigning `SUPER_ADMIN` is reserved to a super admin** (`canAssignRole`), so the policy holds
  even if the use case is ever reached by another caller.

## Periods

Owner: `src/domain/period.ts`, `src/use-cases/periods/`.

- **Dates must be ordered.** `endAt <= startAt` → `invalidDates`.
- **Periods may not overlap.** Half-open comparison `startAt < other.endAt && endAt > other.startAt`
  → `overlappingPeriod`. Enforced on create and on update.
- **A period is current** when `startAt <= now <= endAt`. Between two school years, *no* period is
  current — the application says so rather than guessing.
- **Default period selection**, in order: the current period; else the most recent period that has
  at least one class; else the most recent period; else none. Sorted by `startAt` descending.
- **A period holding classes cannot be archived** → `periodInUse`. Archiving is a soft delete
  (`isActive: false`).

## Levels

Owner: `src/domain/level.ts`, `src/use-cases/levels/`.

- `nextLevelId` chains levels into a progression. It is a **unique** column: two levels cannot share
  the same successor.
- **No cycles.** Walking the chain from the candidate successor must never return to the level being
  edited, and a level cannot point at itself → `circularReference`. The walk also stops on a
  repeated node, so a pre-existing cycle elsewhere cannot hang the check.
- **A level holding classes cannot be archived** → `levelInUse`.

## Classes

Owner: `src/domain/class-period.ts`, `src/use-cases/class-periods/`.

- **Capacity is per class**, stored on `ClassPeriod.capacity`, required at creation and a positive
  integer. The `max_students_per_class` config only supplies the default value in the creation form.
- **A class is full** when `currentEnrolled >= capacity` → `classFull`.
- **Capacity cannot drop below current occupancy** → `capacityBelowEnrolled`.
- **Occupancy counts** assignments with `endAt: null` whose enrollment is `PENDING`, `ACTIVE` or
  `COMPLETED`. Cancelled enrollments free their seat; completed ones do not.

## Enrollments

Owner: `src/domain/enrollment.ts`, `src/use-cases/enrollments/`.

### Lifecycle

```
PENDING ──▶ ACTIVE ──▶ COMPLETED
   │           │
   └──▶ CANCELLED ◀──┘
```

`COMPLETED` and `CANCELLED` are terminal. Any other move → `invalidStatusTransition`
(`VALID_TRANSITIONS` in `src/domain/enrollment.ts`).

### Creation

Atomic in one `db.$transaction`: the capacity count, the enrollment, and the class assignment
(`src/use-cases/enrollments/create-enrollment.ts`).

- Student, plan and class must all exist → `notFound`.
- **One enrollment per student per class** → `duplicateEnrollment`.
- **Capacity is re-counted inside the transaction**, not before it, so two concurrent enrollments
  cannot both pass the check → `classFull`.

### Money

- `totalAmount = plan.amount - discount`, computed at creation and recomputed on every discount
  change against the **plan's current price** — not against the stored total.
- `remainingBalance = max(0, totalAmount - totalPaid)`. It never goes negative.
- Changing a plan's price does not retroactively change existing enrollments. Applying a discount
  does, because it recomputes from the plan.

## Payments

Owner: `src/domain/payment.ts`, `src/use-cases/payments/`.

### The two balances

This distinction is the source of most past confusion. Both are computed by
`calculateFamilyBalance()` in `src/use-cases/payments/family-balance.ts`:

| Figure | Covers | Used for |
|---|---|---|
| `remainingBalance` | `PENDING` + `ACTIVE` enrollments | **Display.** What the family owes overall. |
| `payableBalance` | `ACTIVE` enrollments only | **Collection.** What can be paid right now. |

A family can therefore owe money and still have nothing to pay: its only debt sits on an enrollment
awaiting validation. Both the family page and the parent portal say so explicitly instead of showing
a disabled control with no reason.

### Recording a payment

`recordPayment()` never targets one enrollment. It takes a family-level amount and **distributes it
across that family's `ACTIVE` enrollments**, proportionally to each remaining balance.

- **No active enrollment** → `noActiveEnrollments`.
- **More than the family owes** → `overpayment`. The sum of remaining balances is the ceiling.
- **Rounding is absorbed by the last enrollment**: earlier parts are rounded half-up and capped at
  their own remaining balance, and the last one takes `amount - alreadyDistributed`. The parts
  always sum to exactly the amount received.
- **Zero is rejected** by the schema; a negative amount is a refund.

### Refunds

A negative amount distributes proportionally to what was **actually paid** on each enrollment.
Refunding more than the family ever paid → `refundExceedsPaid`.

### Methods

`CASH`, `CARD`, `TRANSFER`, `CHECK` for manual entry; `STRIPE` exists in the enum but is written by
the checkout flow, not by the form.

- **`cashedAt` applies to cheques only.** Any other method carrying a cash date is rejected by the
  schema (`src/use-cases/payments/schemas.ts`), not merely hidden in the form.

### Online payment (Stripe)

`create-checkout-session.ts` / `complete-checkout-session.ts`.

- Missing Stripe client or webhook secret → `notConfigured`. The feature degrades, it does not crash.
- Nothing payable → `noBalance`. The session is always opened for the **full `payableBalance`**;
  partial online payment is not offered.
- The `PaymentTransaction` row is created **before** the Stripe session and its id is the
  idempotency key.
- The webhook refuses anything that does not match: an already-seen provider event → `duplicate`;
  a transaction already `SUCCEEDED` → `duplicate`; `payment_status !== 'paid'` → `notPaid`;
  a different amount → `amountMismatch`; a different currency → `currencyMismatch`.

## Promotion

Owner: `src/domain/promotion.ts`, `src/use-cases/enrollments/promote-students.ts`.

Moves a finished period's students into the next one. Preview and execution walk the same list with
the same eligibility function, so the announced numbers cannot drift from the applied ones.

A student is **skipped**, with the reason reported, when:

| Reason | Meaning |
|---|---|
| `alreadyPromoted` | Already enrolled in the target period. |
| `noClassAssignment` | No class in the source period, so no level to move from. |
| `noNextLevel` | The level has no successor, or the successor is archived. |
| `noTargetClass` | No active class for that successor in the target period. |
| `targetClassFull` | The target class is at capacity. |

- New enrollments are created `PENDING`, carrying the source plan, amount, discount and
  `canLeaveAlone`. They are not active until someone validates them.
- **One transaction per student**, deliberately: Postgres aborts a whole transaction on any error,
  so a single batch would make a partial report impossible. A failure is reported per student and
  its seat is released back into the in-memory occupancy tally.

## Families, students, people

- **Family name**: required, at most 50 characters (`src/domain/family.ts`).
- **Phone numbers** match `/^\+?[\d\s().-]{6,20}$/`, on parents, emergency contacts and additional
  numbers alike.
- **Update semantics**: on `updateFamilySchema`, optional fields are `nullish` — `undefined` leaves
  the column untouched, `null` clears it. A field emptied in a form must send `null`, not be omitted.
- **A student's birthday must be in the past** → `validationError` (`src/domain/student.ts`).
- **A student carrying a `PENDING` or `ACTIVE` enrollment cannot be archived**
  → `hasActiveEnrollments`.
- **A family cannot be archived either while any of its students holds one** — same discriminant,
  counted across every person linked to the family.

## Configuration

`src/use-cases/config/set-config.ts`. Values are stored as strings with a declared type.

- `NUMBER` must parse as a number, `BOOLEAN` must be exactly `'true'` or `'false'`, otherwise
  → `invalidConfigValue`. `TEXT` and `COLOR` accept anything.
- Consumed today: `school_name` (sidebar), `max_students_per_class` (default class capacity),
  `logo_url` and `favicon_url` (`src/lib/branding-config.ts`).
- **The sidebar falls back to the school name.** With no `logo_url`, the collapsed badge shows the
  first letter of the first two words of `school_name` (`src/features/dashboard/initials.ts`), so a
  renamed school is reflected immediately.

## Branding images

`src/use-cases/media/upload-branding-image.ts`, `src/gateways/storage-gateway.ts`.

`logo_url` and `favicon_url` accept either a URL typed by hand or a file uploaded to the object
store. Both end up as a plain string in `Config`, so an external URL keeps working.

- Uploading requires an admin.
- **Accepted types**: PNG, JPEG, WebP, SVG, ICO. Anything else → `unsupportedType`.
- **1 MB maximum**, and an empty file is refused → `fileTooLarge` / `emptyFile`.
- The object is stored under `branding/<uuid>.<ext>`; the caller never chooses the key, so an upload
  cannot overwrite another one.
- Configuration is `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, optionally
  `S3_REGION` and `S3_FORCE_PATH_STYLE`. Path style is the default, which is what MinIO expects.
  Without those variables the feature answers `notConfigured` rather than crashing — the rest of the
  configuration screen keeps working, and a URL can still be typed by hand.
- **Every environment points at the same MinIO**, local development included; there is no container
  for it in `compose.yaml`. A logo uploaded while developing lands in the shared bucket. Keys are
  UUID-based, so nothing is ever overwritten, but stray objects do accumulate under `branding/`.
- **Objects are served through the application**, at `GET /api/media/branding/…`, not from a public
  bucket. The route refuses any key outside the `branding/` prefix or containing `..`, so the bucket
  needs no public policy and no CORS.

## Invitations

`app/[locale]/(dashboard)/_lib/invitation-actions.ts`.

- Issuing, resending and revoking an invitation require an admin. **Accepting one is intentionally
  public** — that is the point of the link.
- **An invitation can only grant `ADMIN` or `PARENT`.** The schema has no `SUPER_ADMIN` branch, so
  the invitation path cannot be used to escalate. That role is granted only by an existing
  `SUPER_ADMIN` through `changeUserRoleAction`.
- **Valid for 48 hours** from creation.
- An email already tied to an account → `emailAlreadyUsed`.
- A `PARENT` invitation carrying `familyId`/`personId` must match a real `FamilyPerson` whose email
  equals the invited address → `invalidInput`. Either both are supplied or neither.
- **Resending mints a new token** and restarts the 48 hours; the previous link stops working.
  Resending or revoking an already accepted invitation → `alreadyUsed`.
- **The invitation carries its own language** (`Invitation.locale`, default `fr`), chosen when
  sending. The email and the acceptance link use it, so a resend keeps the recipient's language
  rather than adopting the resender's.

## Soft deletion

`src/lib/db.ts` extends Prisma so that `findMany`, `findFirst`, `findUnique` and `count` force
`isActive: true` for: `User`, `Family`, `Person`, `Student`, `PhoneNumber`, `Config`, `Level`,
`Period`, `ClassPeriod`, `Enrollment`, `Payment`, `Plan`.

Two consequences worth knowing:

1. The filter applies to **top-level reads only**. A nested `include`/`select` returns archived rows
   unless the query filters them explicitly.
2. A caller cannot ask for archived rows through those methods — the extension overrides a
   caller-supplied `isActive: false`. Reading archived data needs a deliberate, reviewed path.

`src/lib/db.ts` exposes that path as **`dbArchived`**, the same connection without the filter. Its
only consumer is `src/gateways/user-gateway.ts`, which powers super-admin user management: the list
can show archived accounts, and `reactivateUser` can restore one.

## Known gaps

Real holes, verified against the running application. Not aspirations.

- **The disabled "record a payment" button explains itself through `title` only** — unreachable by
  keyboard, since a disabled button takes no focus, and unannounced by screen readers.
- **Manual payment cannot target a specific enrollment.** Distribution is always proportional across
  every active enrollment of the family.

## Surfacing a rule in the UI

A guard the user cannot read is a guard that does not exist. Every dialog that calls an action must
translate the discriminant it receives, not collapse it into a generic message:

```tsx
toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
```

The matching `errors` block goes in **both** `messages/fr.json` and `messages/en.json`, under the
namespace that component already uses. `t.has()` keeps the generic fallback for discriminants a
given screen cannot produce, so a new one never renders a raw key.

Do not apply this inside a `catch` block — the action's result is not in scope there, and a thrown
error is not a business result.
