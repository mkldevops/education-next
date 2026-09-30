# Business rules

What the application actually enforces, and where. Every rule below is a claim about code in this
repository, with the file that owns it. When a rule changes, change it here in the same commit.

Pure rules live in `src/domain/`. Sequencing and persistence guards live in `src/use-cases/`. Input
shapes live in each feature's `schemas.ts`. Nothing in this document is aspirational — where a rule
that ought to exist does not, it is listed under [Known gaps](#known-gaps).

## Vocabulary

| Term | Model | Meaning |
|---|---|---|
| School | `School` | A school. The tenant: every business row belongs to exactly one. |
| Membership | `SchoolMember` | A user's role inside one school. A user may hold several. |
| Family | `Family` | The billing unit. Owns people, and every payment is attached to one. |
| Person | `Person` | A human. A parent, a tutor, or the person record behind a student. |
| Student | `Student` | The `Person` who attends. One `Person` maps to at most one `Student`. |
| Period | `Period` | A school year. Dated, and the scope of most dashboard reads. |
| Level | `Level` | A grade (CP, CE1…). Levels chain through `nextLevelId`, within one school. |
| Class | `ClassPeriod` | One level taught during one period, with a capacity. |
| Assignment | `ClassAssignment` | A student's seat in a class, `endAt: null` while it holds. |
| Enrollment | `Enrollment` | A student registered on a plan. Carries the money. |
| Plan | `Plan` | A price list entry (Mi-temps, Temps plein…), priced per school. |
| Teacher | `Teacher` | A teacher available to one school. |
| Class teacher | `ClassPeriodTeacher` | A teacher assigned to one class for one period. |
| Teacher expense | `TeacherExpense` | A generic expense note for a teacher, such as food, snacks, supplies, goods purchases, or another reimbursable item. |
| Payment | `Payment` | Money received, always attached to one enrollment. |
| Class schedule slot | `ClassScheduleSlot` | A recurring weekly time slot for one class. |
| Slot teacher | `ClassScheduleSlotTeacher` | An active class teacher assigned to one schedule slot. |

## Multi-school

Every business row belongs to exactly one `School`. Twenty-five models carry `schoolId NOT NULL`:
`Family`, `UserFamily`, `Person`, `FamilyPerson`, `Student`, `PhoneNumber`, `Config`, `Level`,
`Period`, `ClassPeriod`, `ClassPeriodTeacher`, `ClassScheduleSlot`, `ClassScheduleSlotTeacher`, `Enrollment`, `ClassAssignment`,
`AttendanceSession`, `AttendanceEntry`, `Payment`, `PaymentTransaction`, `Plan`, `Invitation`,
`Teacher`, `TeacherExpense`, `Event`, `EventImage`. All of them are in the runtime guard's
`TENANT_SCOPED_MODELS`.

`PaymentProviderEvent` is the one business model left unscoped, deliberately: its
`paymentTransactionId` is nullable, so an unmatched provider event has no derivable school. It is a
platform-level log. `User`, `Session`, `Account`, `Verification`, `Passkey`, `SchoolMember` and
`PlatformSetting` are platform models by nature.

`PlatformSetting` is the instance-wide settings table, and is deliberately **not** a `Config` row:
`Config` carries a mandatory `schoolId` and belongs to the tenant guard, so a platform-level read
would raise `TenantScopeError`. It carries no `isActive` either — a platform setting has no
archival path, and a total `@unique(name)` would let an archived homonym block its recreation.

**A family belongs to one school.** A parent whose children attend two schools of the network has
one account with two memberships, and two separate family records that never see each other.

Isolation rests on three layers. None is sufficient alone.

1. **Schema — composite foreign keys.** Every edge between two scoped models references
   `(fk, schoolId) → Parent(id, schoolId)`, backed by `@@unique([id, schoolId])` on nine parents. A
   cross-school write is a PostgreSQL constraint violation, not a silent bug. This is also what
   protects **nested writes**, which the runtime guard cannot see.
   Consequence to remember: `onDelete: SetNull` is impossible on such a key — PostgreSQL would null
   `schoolId` too, which is `NOT NULL`. Those relations use `Restrict`, and the nullable id is
   cleared explicitly by the use-case instead.
2. **Types — `schoolId` is a required parameter.** Every tenant gateway takes it first, so
   `pnpm type-check` enumerates forgotten callers. This covers every write, since the column has no
   default. It does **not** cover reads performed directly by Server Components, which is why the
   third layer exists.
3. **Runtime — a fail-closed guard.** `src/lib/tenant-guard.ts` inspects the root of every Prisma
   query and reports an unscoped one. It never injects anything: in `throw` mode the query is
   rejected, in `warn` mode it is logged with its stack. The mode is `throw` everywhere —
   development, test, CI and production all read the same fallback in `tenantGuardMode()`, since
   `TENANT_GUARD_MODE` is set in no configuration of the repository. Setting it to `warn` or `off`
   is a diagnostic step, never a way to run.
   A `where` satisfies it through `schoolId`, through `schoolId: { in: [...] }`, or through any
   generated compound selector containing it (`id_schoolId`, `schoolId_name`…). Reassigning a row's
   school is refused, including through the `school` relation.

**The school and the target of a mutation come from the server, never from the request body.**
Dashboard actions receive a client object typed `Omit<Input, 'schoolId' | 'id'>`, but that type does
not exist at runtime and the use-case schemas accept `schoolId`. Actions therefore spread the client
data **first** and write the session `schoolId` (and the `id` argument, `createdById`…) after it —
`updateX({ ...data, id, schoolId })` — so a forged field can never override them. Regression:
`app/[locale]/(dashboard)/_lib/tenant-override-actions.test.ts`.

`SchoolMember` sits outside the guard by construction — the context must read memberships by
`userId` before any school is known. All access goes through `src/gateways/school-member-gateway.ts`,
which is the single read *and* write boundary for that model.

Five named exceptions live in `src/lib/db-unscoped.ts`, each authorised by something other than a
school: the invitation read by its unique token (public flow), the Stripe webhook finding its
transaction by `providerSessionId` (signed request, no session), the reference count before a
definitive account deletion (a platform question, detailed under *Soft deletion*), the retention
purge of expired `McpDraft` rows (an instance-wide sweep, not a tenant read), and the seed and data
scripts, which create the schools themselves.

The `warn` journal was the working list of reads to scope. It is empty, which is what allowed the
switch to `throw`. `app/[locale]/(dashboard)/__tests__/render-reads.test.tsx` keeps it that way: it
drives every dashboard page, `generateMetadata` and layout read through its own loader against the
real database, under `throw`. A read added without a `schoolId` filter fails there, as a
`TenantScopeError` raised by the call itself.

### Importing a legacy database

`scripts/migrate-legacy.mjs` imports the single-school legacy MySQL database into one school of the
target database. `--school-id` is **required**: it is inserted on every row, and it restricts the
cleanup phase.

That restriction is the point. The cleanup used to delete thirteen whole tables, so running the
import against a database holding several schools destroyed all of them — irrecoverably, since the
cleanup commits before the first insertion. `scripts/lib/purge-school.mjs` now deletes only rows
carrying the target `schoolId`, in the purge order of `prisma/seed.ts`, starting with the
`PaymentProviderEvent` rows joined to that school's `PaymentTransaction` since that model carries no
school of its own. `Config` stays out: the script re-imports no configuration, so purging it would
wipe the school's theme and logos with nothing to put back.

**The import is destructive for the target school, beyond what it re-imports.** The script inserts
twelve models; the purge covers more, because the extra ones hold foreign keys that would block the
deletion. `UserFamily`, `Invitation`, `PaymentTransaction` and its `PaymentProviderEvent` rows are
therefore deleted and never written back: a school that already has data loses its parent-to-family
links, its outstanding invitations and its payment transactions, permanently. Only `School`,
`SchoolMember`, `User` and `Config` survive untouched. Run it against a school whose business data
is expendable.

### Administering schools

`/dashboard/schools` is a **platform** surface. The page and the four actions
(`app/[locale]/(dashboard)/_lib/school-admin-actions.ts`) open on `requirePlatformAdmin()`, and the
sidebar entry is gated by the same flag rather than by a school role — `platformOnly` is checked
**before** `requiredRoles` in `src/features/dashboard/sidebar-items.ts`, so a school `ADMIN` cannot
inherit a platform page on the grounds that it demands no school role.

Its reads go through `schoolGateway.listAll()` and `findById()`, which carry **no** `isActive`
filter: a deactivated school must stay visible to be reactivable. Every other read of `School` —
context resolution, switcher, branding — writes the filter explicitly.

Deactivation is refused in two cases. The verdict is pure
(`classifySchoolDeactivation`, `src/domain/school-deactivation.ts`), the enforcement belongs to
`schoolGateway.deactivate()`:

1. **Never the last active school.** With none left, `getSchoolContext()` answers nothing for
   everyone, `/dashboard/schools` included, so the platform could no longer be reactivated from its
   own UI. Checked first, because it is the only irreversible refusal → `lastActiveSchool`.
2. **Not while the school is in use** — `PENDING` or `ACTIVE` enrollments, `PENDING` transactions,
   unused invitations. The three counts come back together so the dialog enumerates what blocks
   instead of asking the administrator to guess → `schoolInUse`.

Both run in one transaction opened by
`SELECT "id" FROM "School" WHERE "isActive" = true ORDER BY "id" FOR UPDATE`. Two concurrent
deactivations would otherwise each see the other school still active and leave the platform with
none. The counts are taken under that same lock, so nothing can appear between the check and the
write. Reactivation carries no such condition.

### The school switcher

`src/features/dashboard/school-switcher.tsx` occupies the head of the sidebar, where the school name
and logo used to sit. The list comes from `getAuthorizedSchools()` — the user's active memberships,
or every active school for a super-admin — loaded by `app/[locale]/(dashboard)/layout.tsx` in
parallel with the branding. Deactivated schools are excluded at the source, so none can be offered.

A user who holds a single school sees a **static brand, not a menu**: a menu of one choice is not a
choice. Selecting another school calls `switchSchoolAction`, which rewrites the `active_school`
cookie, then `router.refresh()` replays the dashboard in the new school. The action re-checks the
membership; the cookie is never trusted on the way back in.

The switch can be closed platform-wide by the `school_switch_enabled` `PlatformSetting`, written from
the **Schools** section of `/dashboard/config` by a super-admin only. **Absence of the row reads as
enabled** — the migration seeds nothing, so an existing installation keeps its switcher — and so does
any unexpected value: an unreadable setting must not silently remove a working feature
(`src/domain/platform-settings.ts`).

The flag constrains **both** ways of changing school, because a cookie is an input and not a
decision. `switchSchoolAction` refuses with `switchDisabled` **before** looking the target school up,
so a caller denied the switch cannot learn whether that school exists. And `getSchoolContext()`
ignores `active_school` for an ordinary member while the flag is off, falling back to their first
membership — guarding only the action would leave the switch reachable by hand-editing the cookie,
since `httpOnly` blocks `document.cookie` but neither the devtools Application panel nor `curl`. That
second read is where the cookie is already validated, so the flag is one more constraint on which
school it may select rather than a mechanism bolted alongside; it is consulted only when the cookie
would actually change the retained school.

**A super-admin is never blocked on the server**: the flag governs the school-to-school move of
ordinary members, not platform administration. The sidebar head is the one exception, and it is a
display rule: `layout.tsx` reads `isSchoolSwitchEnabled()` directly, so a super-admin who turns the
setting off sees the switcher disappear from their own sidebar. The deep-link escape hatch stays
open through `canSwitchSchool()` (`app/[locale]/(dashboard)/_lib/school-switch.ts`), which keeps the
super-admin bypass.

The flag changes nothing else. `getAuthorizedSchools()` is untouched, so deep-link resolution still
names the other school; `_components/school-switch-prompt.tsx` keeps the screen and drops the button,
because hiding the resolution would leave the user in front of an unexplainable `notFound()`.

## Sign-in methods

### Account creation is closed

No sign-in method creates an account. Two server paths do, and only them: accepting an invitation
for an unknown address (`acceptInvitationAction`) and an administrator's `createUserAction`. Both go
through `credentialUserGateway.create()` (`src/gateways/credential-user-gateway.ts`), which writes
the user and its `credential` `Account` through Better Auth's internal adapter — same hash, no
session — with `emailVerified: true`, since the address is proven by the token or typed by an admin.

`src/lib/auth.ts` closes every other door, because a pre-created account for a future invitee
would let a third party keep a session on it and see the family once the invitation is accepted:

- `emailAndPassword.disableSignUp` — `POST /api/auth/sign-up/email` answers `400`
  (`EMAIL_PASSWORD_SIGN_UP_DISABLED`). It also closes `auth.api.signUpEmail` on the server, which
  is why the two legitimate paths no longer call it.
- Google carries `disableSignUp` (redirect callback) and `disableImplicitSignUp` (the `idToken`
  flow, which ignores `disableSignUp`). Google signs in to, or links, an **existing** account only;
  an unknown address is sent back with `signup_disabled`. Implicit linking also requires the local
  account's `emailVerified` (Better Auth's `requireLocalEmailVerified`, on by default).
- `databaseHooks.user.create.before` refuses any user creation that runs inside a Better Auth
  endpoint, which catches an explicit `requestSignUp: true` and any future plugin route. The gateway
  runs outside an endpoint and is the only writer left.
- `revokeSessionsOnPasswordReset` — a password reset proves the mailbox, so every session opened
  before it dies with the old password.

`requireEmailVerification` stays false: every account is born verified, and a sign-in check would
only block a user whose address an admin just rewrote (see **User management**).

Email and password is the method this application always offers. The two alternatives are governed by
`PlatformSetting` rows written from the **Sign-in methods** section of `/dashboard/config`. That page
is open on `requireSchoolAdmin()`, and the platform sections are rendered only when the caller is a
super-admin; the write actions re-check `requirePlatformAdmin()`:

- `google_sign_in_enabled` — the "Sign in with Google" button and Google account linking.
- `passkey_sign_in_enabled` — passkey sign-in and the registration of new passkeys.

Both follow the same reading as `school_switch_enabled`: **absence of the row reads as enabled**, and
so does an unexpected value (`readsAsEnabled`, `src/domain/platform-settings.ts`). All three go
through the memoised `readPlatformFlag()`
(`src/use-cases/platform-settings/read-platform-flag.ts`), so one render costs one read per flag.

Google carries a second, independent condition: `isGoogleConfigured` (`src/lib/social-providers.ts`)
requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Without credentials `betterAuth` receives
empty strings and the redirect fails, so the setting alone must never surface the button. The
platform page states this rather than hiding the toggle — a super-admin needs to know the setting is
inert and why.

`isGoogleSignInAvailable()` (`src/use-cases/platform-settings/`) combines both conditions for the
pages that decide whether to render the button, `/login` and `/dashboard/settings`.
The sign-in section of `/dashboard/config` keeps `isGoogleSignInEnabled()` and `isGoogleConfigured`
separate on purpose: the toggle reflects the setting alone, and the hint above explains when it is
inert.
`app/api/auth/[...all]/route.ts` only checks the flag — an unconfigured environment already fails
the redirect inside `betterAuth`, so the route does not need to test `isGoogleConfigured` too.

Each flag is enforced on the server, not only in the UI, because both entry points are callable
boundaries:

- `getPasskeyRegistrationOptions()`, `verifyPasskeyRegistration()`,
  `getPasskeyAuthenticationOptions()` and `verifyPasskeyAuthentication()` return `signInDisabled`
  before touching a challenge, and `POST /api/passkey/authenticate` answers `403` after the rate
  limiter (`src/actions/passkey-actions.ts`, `app/api/passkey/authenticate/route.ts`).
- `app/api/auth/[...all]/route.ts` wraps the Better Auth handler and refuses `/sign-in/social`,
  `/link-social` and `/callback/*` with `403`, on `GET` as well as `POST`. Google is the only
  declared social provider, so the path identifies the request and no body has to be read. The
  provider callback is guarded alongside the departure: a flow opened before the switch would
  otherwise still land and issue a session, for the lifetime of the stored `state`. The path is
  matched against the handler base (`/api/auth`), never with a loose suffix test.

Disabling Google **does not unlink** an account that is already linked: the card stays visible in
`/dashboard/settings` with its disconnect action, so nobody is left with a credential they can
neither use nor remove.

Disabling passkeys follows the same rule. `/dashboard/settings` keeps the passkey card as long as
the user owns at least one, with its list and its delete action, and drops only the registration
form — replaced by a sentence stating why (`_components/passkey-section.tsx`). The card disappears
entirely when nothing is left to administer, no passkey and registration closed, exactly like the
Google card without a linked account. This is why `getUserPasskeys()` and `deletePasskey()` take a
session and nothing else: putting them behind the flag would lock a user out of credentials they can
no longer use.

The page reads that list server-side and hands it down as a prop, like `linkedAccounts`. Loading it
from the client would leave the card absent for the length of the round trip — the very symptom the
rule forbids. Deletion is confirmed through a notification rather than a banner inside the card,
because removing the last passkey while the flag is off unmounts the card in the same render.

A Google-only account — one whose only `Account` row carries `providerId: 'google'`, with no
`credential` or other identifier — loses every sign-in method entirely if the flag is turned off:
email and password requires a `credential` `Account`, which such a user never created.
`userGateway.countGoogleOnlyAccounts()` (`src/gateways/user-gateway.ts`) counts them through `db`,
so the shared `isActive` extension (`src/lib/db.ts`) excludes a deactivated user the same way as
everywhere else — an archived account already lost access through that archival, not through this
flag. The count does **not** exclude an account that also holds a `Passkey`: passkey sign-in is
itself governed by its own, independently mutable flag (`passkey_sign_in_enabled`), so anchoring the
warning to Google/credential enrollment rather than to that other flag's current state keeps it from
silently drifting when an unrelated toggle changes, and the recovery path below holds regardless of
passkey enrollment.

`/dashboard/config` requires an explicit confirmation naming that recovery path before the Google
toggle goes enabled → disabled while the count is greater than zero (`FlagToggle`'s
`confirmDisable`, `app/[locale]/(dashboard)/_components/flag-toggle.tsx`). Re-enabling
stays the original one-click toggle, and so does disabling when the count is zero — the
confirmation is additive friction on top of the existing optimistic toggle, not a new toggle shape.
The passkey toggle in the same **Sign-in methods** section never receives it either, and neither do
the school-switch toggle in **Schools** or the MCP toggle in **Integrations** — the two other
sections of the same page.

The recovery path itself needs no code: `/forgot-password` and `/reset-password` are public and read
no platform flag. Better Auth's `resetPassword` handler creates the missing `credential` `Account`
when none exists instead of requiring one, so a Google-only account can request the reset e-mail and
set a password from it after the flag is off, exactly as the confirmation names.

### Proposing a stronger method after a password sign-in

A user who only holds a password is offered a stronger method once they reach the dashboard. The
offer is a dialog mounted in the `(dashboard)` layout, decided server-side by `SignInUpgradeGate`
(`app/[locale]/(dashboard)/_components/sign-in-upgrade-gate.tsx`) from one `User` read (`google`
`Account` rows, passkey count, `signInUpgradeDismissedAt`) and the two sign-in flags, and rendered by
`SignInUpgradeDialog` (`src/features/auth/sign-in-upgrade-dialog.tsx`). The pure decision lives in
`resolveSignInUpgradeOffer()` (`src/domain/sign-in-upgrade.ts`):

- Nothing is offered once the user has dismissed the prompt, linked a Google account, or registered
  a passkey. Each of those is read from the database, not from the session, so it holds on every
  device.
- Google is offered only to a `@gmail.com` address (`isGmailAddress()`, case-insensitive suffix
  match — `googlemail.com` and Workspace domains are excluded on purpose: the offer must never
  send a user to a Google account they do not have) and only while `isGoogleSignInAvailable()`
  holds. Every other address is offered a passkey only.
- A passkey is offered only while `isPasskeySignInEnabled()` holds **and** the browser exposes
  WebAuthn (`browserSupportsWebAuthn()`, read after hydration). Without WebAuthn a non-Gmail user
  sees no dialog at all, and that silence records nothing.
- Impersonation shows nothing: the gate returns before reading the account when
  `isImpersonating(session)` holds, because a passkey or Google link created in that state would
  belong to the target. The server action keeps the same guard.

"Later" is durable: `dismissSignInUpgradeAction` (`src/actions/profile-actions.ts`) stamps
`User.signInUpgradeDismissedAt` for the session user only, behind `guardCredentialOperation`.
Escape and a click outside the dialog are the same refusal as the button — all three go through the
dialog primitive's close — so a user is never asked twice after any of them. A failed or cancelled
WebAuthn ceremony, a failed passkey verification, or a failed Google link keeps the dialog open with
an inline error and records nothing. A successful passkey registration closes the dialog with a
notification and refreshes the route; a successful Google link returns to
`/dashboard?signInUpgrade=google`, where the dialog shows the notification only if a `google`
`Account` now exists, then strips the parameter. Either success leaves the timestamp untouched: the
gate has nothing left to offer, so no refusal needs recording.

Google linking reuses `linkSocial` from `@/lib/auth-client`, the same call as the account section of
`/dashboard/settings`. Note that `src/lib/auth.ts` sets `account.accountLinking.allowDifferentEmails:
true`, so Better Auth does **not** require the Google e-mail to match the account's e-mail during
linking. The Gmail-only offer therefore narrows *who is invited*, not what linking accepts; the
linking policy itself is an authentication boundary outside this feature.

## Roles and scope

Roles are **per school**. `SchoolRole` is `ADMIN` or `PARENT` (`src/types/enums.ts`), carried by a
`SchoolMember` row. Platform level is a separate flag, `User.isSuperAdmin`. There is no longer a
global `User.role`, and `SUPER_ADMIN` is not expressible as a school role — the invalid state is
unrepresentable in the database as well as in the types.

- The active school of a request is resolved by `getSchoolContext()`
  (`src/lib/school-context.ts`) and **revalidated against the database on every request**. Better
  Auth caches its session payload for five minutes (`src/lib/auth.ts`), so reading the role or the
  membership from the session would delay a revocation by that much.
- The active school comes from the `active_school` cookie. **The cookie is untrusted input**: it is
  only honoured if the user holds a matching `SchoolMember`, or is a super-admin, and the school is
  active. Otherwise the context falls back deterministically to the oldest eligible school.
- `requireSchoolAdmin()` admits a school `ADMIN` or any super-admin. `requirePlatformAdmin()` admits
  only a super-admin. `requireSchoolScope()` returns `{ isAdmin: true }` for staff, or
  `{ isAdmin: false, familyId }` for a parent — **a parent with no linked family gets `notFound()`**
  rather than an unscoped query. `requireSchoolSession()` establishes the session without demanding
  any capability, and is what the detail pages use: their authorization is carried by the deep-link
  query itself, which must look past the active school. All four live in
  `app/[locale]/(dashboard)/_lib/auth-helper.ts`.
- A super-admin holds **no** `SchoolMember`. Its context branch carries `role: null`, so the code
  never invents a school role for it.
- **`/dashboard/users` lists memberships, not accounts.** Its root query is `SchoolMember` scoped to
  the active school; `User` has no `schoolId` and could not be filtered.
- **Removing a member or demoting them cannot leave a school without an administrator.** The check
  and the mutation share one `Serializable` transaction in
  `src/gateways/school-member-gateway.ts` → `lastAdmin`. Both operations, and the MCP key cap
  below, go through `inSerializableTransaction` (`src/lib/serializable-transaction.ts`), which
  replays a serialization abort (`P2034`) exactly once: PostgreSQL aborting one of two concurrent
  transactions is how the rule holds, but the loser must get the verdict rather than an exception.
  Deactivating a platform account refuses self-deactivation and refuses to remove the last active
  super-admin → `selfDeactivation`, `lastSuperAdmin`
  (`app/[locale]/(dashboard)/_lib/user-actions.ts`).
- **Platform account mutations require a super-admin** — granting or revoking platform level,
  profile edit, archiving, restoration, permanent deletion, session revocation, password reset,
  family link and unlink (`app/[locale]/(dashboard)/_lib/user-actions.ts`, `requirePlatformAdmin()`).
  A school `ADMIN` manages memberships and invitations for its own school; the page hides the
  controls it cannot use, and the actions refuse them regardless of what the UI shows.
- **The user drawer is scoped to the active school.** `userGateway.findDetail(id, schoolId)` filters
  the nested families, invitations and activity counters. Without that filter a school `ADMIN`
  reading a parent shared with another school saw that school's family and children by name — the
  tenant guard cannot catch it, because it only inspects the root of a query. `Session`, `Account`
  and `Passkey` stay global: they belong to no school.
- **Creating a school user does not need a role-escalation check.** The removed `canAssignRole`
  existed to stop a school `ADMIN` from minting a *global* `ADMIN`. With the role carried by
  `SchoolMember`, an admin naming another admin only ever affects its own school, and the
  anti-lockout invariant covers the rest.
- **`User.id` comes from Better Auth, not from Prisma.** The `@default(cuid())` in the schema never
  fires, and real ids are 32 alphanumeric characters that `z.cuid()` rejects — every account
  mutation answered `validationError`. User ids validate as `z.string().min(1)`, the convention
  already used for `Invitation.id`. Business models keep `z.uuid()`: Prisma does generate those.
- A resource outside a parent's family answers `notFound()`, never `forbidden()` — the existence of
  another family's student is not disclosed. The same holds across schools.

### Deep links

The active school lives in a cookie, so a shared URL does not carry its school. Opening
`/dashboard/students/<id>` for a resource of another school must therefore not answer `notFound()`
when the reader legitimately holds that school.

The four detail pages — students, families, enrollments, classes — resolve through
`resolveDeepLink()` (`app/[locale]/(dashboard)/_lib/deep-link.ts`) and the pure classification in
`src/domain/school-scope.ts`:

1. the authorized schools come from `getAuthorizedSchools()` — the user's memberships, or every
   active school for a super-admin;
2. **one single query** carries them at its root, `where: { id, schoolId: { in: [...] } }`. There is
   no lookup by `id` alone at any point, so an unscoped read cannot exist to be checked afterwards;
3. a hit in the active school renders the page;
4. a hit in another **authorized** school renders the switch offer (`SchoolSwitchPrompt`), which
   calls `switchSchoolAction` and re-renders;
5. anything else is `notFound()` — never `forbidden()`, and never a switch offer, since offering one
   would disclose that the resource exists.

`generateMetadata` calls the **same** `React.cache()`-wrapped resolver as the page. The two used to
issue two differently shaped queries; they now share one, and the title of a resource the reader
cannot open is the 404 title.

Capability is per school. A user who is `ADMIN` of A and `PARENT` of B must not read B's whole
roster, so `adminOrLinkedTo()` nests `OR: [{ schoolId: { in: adminSchoolIds } }, <linked to viewer>]`
**under** the root `schoolId`. The root keeps the tenant guard satisfied — it does not traverse `OR`
— and the capability clause narrows what the reader may open in the schools they do not administer.
Classes resolve with `requireAdmin: true`: a parent is never offered a switch toward a class.

`src/lib/__tests__/school-isolation.test.ts` pins this against a real database, one case per
tenant-scoped resource. Written with `db` mocked they would only test the mock.
- **There is no public sign-up.** `/register` was removed and the Better Auth endpoint is closed on
  the server (see **Sign-in methods**). An account is born from an accepted invitation or from
  `createUserAction`, nothing else.

`proxy.ts` protects `/dashboard`, `/settings`, `/profile` coarsely. Its matcher **excludes `/api`**,
so every route handler and Server Action authenticates itself.

## Machine access (MCP)

`POST /api/mcp` exposes the application to an agent — Claude or Codex — over the Model Context
Protocol. A photographed paper form becomes typed tool calls; **the image never reaches the server**.
Vision happens in the agent, so the route is an ordinary typed API guarded like any other, not an
upload endpoint. `docs/mcp.md` documents the client side.

The whole surface is governed by a fourth `PlatformSetting` row, `mcp_enabled`, written from the
**Integrations** section of `/dashboard/config` (rendered for a super-admin only, written behind
`requirePlatformAdmin()`). It reads the opposite way
from the three sign-in flags: **absence of the row reads as disabled** (`readsAsOptedIn`,
`src/domain/platform-settings.ts`). A write API for machines does not open itself on the deployment
that ships its migration; only an affirmative value activates it. Like the three sign-in flags, the
read is memoised per render, through `readPlatformOptInFlag()` — the opt-in sibling of
`readPlatformFlag()` in the same `src/use-cases/platform-settings/read-platform-flag.ts`.

### Who may hold a key

`ADMIN` of the key's school, or a super-admin. **A `PARENT` never reaches the MCP**, and the refusal is
structural rather than a branch: `McpScope` (`src/use-cases/mcp/resolve-mcp-scope.ts`) has no parent
variant. A parent's authorization has the shape of a `familyId`, not a `schoolId`; admitting it would
build a second confinement mechanism beside the tenant guard.

The `schoolId` comes from the key and is injected into every use-case call. No tool takes a school
argument — an identifier is exactly what a vision model invents — so multi-school isolation is the
tenant guard's, with no dedicated code.

The MCP's four class-planning tools use the existing recurring `ClassScheduleSlot` use cases and
their feature flag, time-range, teacher-assignment and overlap rules. `list_class_schedule_slots`
publishes only slots of active classes in the requested period of the key's school, with active
teacher identities. Create and update return only the slot ID and teacher-overlap warnings; delete
returns a success object so the MCP does not mistake the use case's string `OK` for an error. A whole
planning goes through the `class_schedule` preview/commit pair ([Write drafts](#write-drafts)): all
its slots are written in one transaction, or none.

`resolveMcpScope()` **returns** a verdict instead of navigating, because the four helpers of
`app/[locale]/(dashboard)/_lib/auth-helper.ts` all end in `redirect()` or `notFound()` and none is
usable from a JSON-RPC handler. It re-reads revocation, expiry, `User.isActive` and the `SchoolMember`
row **on every call**: a durable credential must never outlive the right that justified it. A revoked
key and an expired key are refused identically — telling them apart would teach the bearer that a key
existed.

### Key lifecycle

`McpApiKey` rows are created from the "API keys" tab of `/dashboard/settings`, which appears only for a
school admin while the flag is on. The token is `edu_mcp_` plus 32 random bytes in base64url, **stored
as SHA-256 only** and shown in clear exactly once. Unlike `Invitation.token` (short, single-use, mailed),
an API key is durable and carries write access, so it must not exist in clear in the database.
The 12-character `prefix` is the sole visual landmark of the list.

- Expiry is mandatory: 30, 90 or 365 days, 90 by default. A key without an end of life is not a key.
- Revocation writes `revokedAt`; the row is never deleted, so the audit trail survives. The
  `userId` foreign key is therefore `Restrict`, and `mcpApiKeyGateway.countForUser` makes a key —
  revoked or not — block the permanent deletion of its holder's account. Cascading the account
  deletion would have erased exactly the evidence this rule promises to keep. An OAuth connection
  (`McpOAuthGrant`, below) follows the same rule, counted in `countRowsBlockingUserDeletion`.
- Five live keys per (user, school) pair. The count and the insert share one `Serializable`
  transaction in `src/gateways/mcp-api-key-gateway.ts` → `tooManyKeys`, for the reason already
  written for `lastAdmin`: counting outside the write lets two concurrent creations read the same
  total and both pass. That cap is the only bound on the number of durable secrets one account
  emits on one school.

The table is **excluded from `TENANT_SCOPED_MODELS`** for the reason already written for `SchoolMember`:
it is a discovery table, read by `keyHash` before any school is known. Its single boundary is
`src/gateways/mcp-api-key-gateway.ts` — no further exception in `src/lib/db-unscoped.ts`.

### Route guards

The order in `app/api/mcp/route.ts` is deliberate: credential read → address rate limit, charged to
any request that does not present a well-formed credential (an `edu_mcp_` key or an `edu_oat_`
access token) → retention sweep → platform flag → scope → per-credential rate limit → handler. Reading the credential and checking its shape are pure operations, so
they select the applicable tier before the flag costs a database read; the flag is still read before
authentication so a closed instance answers `503` without ever looking up a key. Keying the tier on
presence alone would let `Authorization: Bearer x` escape both tiers while still paying that read on
every request. The sweep sits above the flag on purpose and is the one thing a closed instance still
does, since retention cannot depend on the service being open.

Two rate-limiting tiers because they measure different things. Claude reaches the server from Anthropic's
infrastructure, not from the user's machine, so `x-forwarded-for` names a handful of shared egress
addresses — and without that header every caller falls into the single `'unknown'` bucket. An address is
therefore not a caller but a budget shared by every school, so the address tier (120/min) charges only
what it is meant to damp: requests presenting no well-formed key. **The real budget is the key's**
(600/min), one user on one school, applied after the scope resolution.

Any well-formed key the route does not serve consequently escapes both tiers: unknown, revoked or
expired it costs the platform-flag read then one indexed `findByHash`, and a key whose holder lost the
right goes on through the membership reads before its `403`. Bounding that per address would recreate
the cross-school denial this separation removes: a flood of failures from the shared egress address
would refuse the valid keys arriving from it.

The IP tier is only worth its cost if its key cannot be chosen by the caller. `getClientIp`
(`src/lib/rate-limit.ts`) therefore reads `x-forwarded-for` **from the right**, at
`length - TRUSTED_PROXY_HOPS` (default `1`, accepted range `0..4`, and anything else — a stray
space, `0x10`, `5` — falls back to that default): the last hops were appended by our own proxies,
while everything before them was sent by the client. Reading the first entry let a caller rotate a
forged prefix and mint one counter per imagined address, so the only pre-auth brake was optional.

The guarantee holds **only if the count is exact**, and each counted proxy must *append* the peer
address (nginx `$proxy_add_x_forwarded_for`). Declaring too few hops buckets every caller behind the
outermost proxy together. Declaring too many is narrowed, not closed: a chain **shorter** than the
declared hops did not traverse the announced proxies, so its entries are unattributable and the
request falls into the single `unknown` bucket, but a caller who pads the chain up to that length
moves the read index back into the part it writes itself. There is no safe direction to be wrong in.

There is also **no `x-real-ip` fallback**: that scalar carries no hop count, and `next start` fills
`x-forwarded-for` from the socket address when the header is absent
(`next/dist/server/base-server.js`, `??=`), so the fallback would only ever have served a caller who
sends an *empty* `x-forwarded-for` — the one case worth refusing.

`TRUSTED_PROXY_HOPS=0` declares that no forwarding header is verifiable: every pre-auth request then
shares one counter, so the passkey tier becomes 10 authentications per minute for the whole instance.

The tracked-key cap evicts the **least recently used** key, refreshed on refused calls too: evicting
by insertion order dropped an established client before a freshly forged address, and let a blocked
key buy a new budget by getting itself evicted.

`POST` only; `GET` and `DELETE` answer `405`. The route **never reads a cookie** and never calls
`auth.api.getSession()`, so it carries no ambient authority and a browser cannot set `Authorization`
cross-origin — CSRF is impossible by construction rather than by `Origin` validation. That invariant is
pinned by a test. `AuthInfo` carries the key's public `prefix` as its `token`, the `keyId` as
`clientId` and the resolved scope in `extra` — never the presented key, which the SDK could serialize
into an error. The same invariant holds one level higher: the SDK hands the `Request` it receives to
the server factory and to every tool's execution context, so the route forwards a clone stripped of
`Authorization`, `X-API-Key`, `Cookie` and `Proxy-Authorization`
(`app/api/mcp/_lib/forwarded-request.ts`) rather than the original. Removal rather than an allowlist:
the header set the protocol requires moves with the SDK, and a forgotten one would surface as a
runtime `406`, not a compile error.

### Refusals

| Body | Status | Cause |
|---|---|---|
| `mcpDisabled` | 503 | `mcp_enabled` absent or not affirmative |
| `unauthorized` | 401 | no credential, malformed, unknown, revoked or expired key or access token, revoked connection, token issued for another site |
| `forbidden` | 403 | deactivated account, deactivated school, non-`ADMIN` membership |
| `tooManyRequests` | 429 | address tier exhausted by traffic without a well-formed credential, or credential tier exhausted |
| `methodNotAllowed` | 405 | `GET` or `DELETE` |

Every `401` carries `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"`
(RFC 9728), with `error="invalid_token"` when a well-formed but refused credential was presented:
that header is how an OAuth client discovers the authorization server this application operates
(*OAuth connections* below). The origin is `NEXT_PUBLIC_APP_URL`, never the request's `Host`, so a
forged host cannot point a client at another authorization server. The header names the flow, not
the cause: a bad key and a revoked connection are told apart by nothing a client can see.

### OAuth connections

ChatGPT, and any client that cannot hold a pasted key, authenticates through OAuth 2.1 against an
authorization server the application operates itself (`docs/mcp.md`, *Personal ChatGPT connection*).
Better Auth 1.7 ships no provider plugin for this, and an external identity provider would put the
list of who may administer which school outside the database that enforces it. The pieces are the
domain module `src/domain/mcp-oauth.ts`, the use cases under `src/use-cases/mcp/oauth/`, the routes
under `app/api/mcp/oauth/` and `app/.well-known/`, and the consent page
`app/[locale]/(auth)/oauth/authorize`.

- **A connection is `McpOAuthGrant`: one user, one school, one client, one resource.** The school is
  chosen on the consent page among those the signed-in account administers (`ADMIN` membership, or
  any active school for a super-admin), never sent by the client, and the resource is this site's
  `/api/mcp` URL. Every `/api/mcp` call re-resolves the whole chain (`resolveMcpOAuthScope`,
  `src/use-cases/mcp/resolve-mcp-scope.ts`): token shape → token by hash, kind `ACCESS`, unexpired,
  unrevoked → grant unrevoked → grant resource equals this deployment's resource → account active →
  school active, payments flag → super-admin or `ADMIN` membership. Nothing is cached between calls,
  so a revoked connection, a withdrawn role or a deactivated school refuses the next call, not the
  next token. Site A's tokens are refused by site B as `unauthorized` before any user is read: the
  audience is compared, not merely recorded.
- **The resulting `DraftScope` is the key's**, with `owner: { kind: 'OAUTH_GRANT', grantId }` and the
  grant's id as `credentialId`. Reads, writes, preview/commit pairs, duplicate protection and the
  per-credential rate limit run unchanged on it; no tool takes a site or school argument.
- **Public clients only, registered dynamically.** `POST /api/mcp/oauth/register` (RFC 7591) accepts
  a `client_name`, one to five `redirect_uris` — `https`, or `http` on a loopback host, never with a
  fragment — and `token_endpoint_auth_method: none`; nothing else, so no client secret exists to
  leak. PKCE `S256` is mandatory on every authorization (`code_challenge_method` is refused
  otherwise), and the code exchange checks `code_verifier`, `client_id` and `redirect_uri` against
  what the code was issued for. `McpOAuthClient` rows are shared by every school and sit outside the
  tenant guard.
- **The consent page is the only place a school is chosen**, and it decides in this order:
  validate the request (an unregistered client or a foreign `redirect_uri` is shown as an error and
  never redirected; every other fault is shown with a link that carries the OAuth error back to the
  registered URI, which the user follows — never an automatic redirect, since a dynamically
  registered URI is not trusted enough to make this page a redirector, RFC 9700 §4.11) →
  platform flag → session, else login with the whole request replayed after → the list of schools
  → the form. The action re-validates the request from the form and redirects only to the URI it
  validated, never to one read from the form. A super-admin impersonating cannot grant: the
  connection would be signed by the target.
- **Secrets are opaque, prefixed and hashed.** Authorization codes (`edu_oac_`, 5 minutes), access
  tokens (`edu_oat_`, 1 hour) and refresh tokens (`edu_ort_`, 30 days) are 32 random bytes in
  base64url stored as SHA-256 only, in `McpOAuthToken`, which cascades from its grant and sits
  outside the tenant guard for the reason already written for `McpApiKey`: it is read by hash
  before any school is known. A refresh token is rotated at each use. Presenting a consumed code or
  a rotated refresh token a second time revokes the whole connection: a replay proves the secret
  left the client, and the legitimate holder recovers with one consent rather than sharing a
  compromised grant.
- **Revocation is a `revokedAt` on the grant, never a deletion.** It happens from the Connected apps
  panel (`revokeMcpOAuthGrantAction`, scoped by holder and school, refused under impersonation) or
  from `POST /api/mcp/oauth/revoke` (RFC 7009, `200 {}` whether or not the token was known, so the
  endpoint enumerates nothing). Expired tokens are swept from `/api/mcp` in `after()` like drafts,
  at most once per interval; the grant row survives as the trace the panel shows, and its `userId`
  foreign key is `Restrict` for the reason written under *Key lifecycle* — counted before a
  permanent account deletion by `countRowsBlockingUserDeletion`, the platform-wide exception to the
  tenant guard, since the question has no school.
- **Discovery is served, not configured.** `/.well-known/oauth-protected-resource` (also under
  `/api/mcp`) and `/.well-known/oauth-authorization-server` derive every URL from
  `NEXT_PUBLIC_APP_URL`; no environment variable was added. The registration, token and revocation
  endpoints answer `OPTIONS` with `access-control-allow-origin: *` for browser-based clients, never
  cache, and turn an unexpected failure into `server_error` rather than a stack trace.
- **Rate limits per address**: registration 10/hour (each one writes a row), token and revocation
  60/minute. Registration and the token endpoint answer `503 temporarily_unavailable` while the
  platform flag is off; revocation stays reachable, since refusing to revoke protects nobody.

### Reads

The six read tools do not reuse the dashboard's gateways. `src/gateways/mcp-read-gateway.ts` carries
one explicit `select` per tool and is the only boundary they read through. Reusing
`teacherGateway.list` published every column of `Teacher`, `email` and `phone` included, and any
column added to the model later would have followed it into the model provider's context without a
single MCP review. The published surface is therefore written where the MCP reads, not where a
screen is built; `docs/mcp.md` lists the columns.

### Write drafts

A write is never one call. **`preview_*` resolves and persists a plan, `commit_*` engages it**, and
the two are joined by an `McpDraft` row (`src/gateways/mcp-draft-gateway.ts`, the model's single
boundary). The reason is the caller: the fields come from a photograph read by a vision model, so a
human has to see the resolved plan — the class and the plan it picked, the split it computed —
before anything is written.

**The commit decides nothing, but it re-checks everything that could have moved.** The plan —
including how a payment divides across siblings — is the preview's and is stored in `resolved`; the
commit reads it back, revalidates its shape, and writes it unchanged. What it does re-run, inside its
own transaction, are the two counts the preview could only observe: **class occupancy** → `classFull`,
and the family's **fresh balances** → `overpayment`, `noPayableEnrollments`, `refundExceedsPaid`, or
`staleDraft` when the recomputed split no longer matches the one the human validated. Without that,
two drafts prepared on the same free seat, or on the same outstanding balance, would both land. A
plan computed on a stale reading must not silently become a different write, so a draft lives
**thirty minutes** (`MCP_DRAFT_TTL_MINUTES`, `src/domain/mcp-draft.ts`) and is then refused.

**A non-empty `blockers` writes no draft at all**, so there is nothing to commit. Each entry names
the field, the value read and the reason — `unknownClass`, `ambiguousPlan`, `classFull`,
`overpayment`, `birthdayNotInThePast`. An opaque `validationError` would force a vision model to
re-guess the whole form instead of correcting one digit. `warnings` is the opposite: an existing
namesake or a receipt number already banked never blocks, because only a human can tell a duplicate
from a sibling.

**The class is carried by the student, not by the family.** A family sheet routinely spreads its
children across classes — « C4 / C2 / F » on one line — and a root-level class would force the
siblings into separate `preview_enroll_family` calls; each call creates a family, so the siblings
would come back as duplicates. Every class blocker names the child, `students.2.className`.
Capacity is counted **per class visited** — three siblings spread over three classes take one seat
in each, two siblings sharing a class take two there — and a full class blocks each of its
siblings, since no single one is the one in excess.

**The plan is carried by the student too, with the family's as default.** A school prices older
children on their own plan — 90 for a teenager next to a sibling at 180 — and one plan per call would
split the family for the same reason as the class. A student's `planName` overrides the root one;
each enrollment's `totalAmount` is computed from its own plan (`src/use-cases/mcp/preview-enroll-family.ts`),
and the payment split follows those totals. An unresolved label the student carries blocks as
`students.1.planName`, the root label as `planName` once. The discount is applied per enrollment, so
a discount above the cheapest resolved plan → `discountExceedsPlan`.

**No input schema may hold a type JSON Schema cannot express** — no `z.date()`, no
`z.coerce.date()`, no `.transform()`. The SDK converts every `inputSchema` to answer `tools/list`,
and a single unconvertible field makes that listing throw for **all** tools, read tools included: the
server becomes unusable. Dates therefore enter as ISO strings (`src/use-cases/mcp/schemas.ts`) and
become `Date` in the use case, after the `safeParse`. A payment date is a day or a zoned timestamp
(`z.iso.datetime({ offset: true })`); **a birthday, when given, is a day only** (`z.iso.date()`),
because an offset timestamp would land on the previous UTC day where the dashboard stores UTC
midnight. A test in `src/mcp/server.test.ts` runs `z.toJSONSchema()` over every registered tool,
because the failure shows up nowhere but in production.

The duplicate probe is not defensive politeness. Prisma has **no uniqueness on `Family(schoolId,
name)`, none on a `Person` name, and `Payment.reference` is nullable and not unique**; the only
structural guard is `Student @@unique([personId, schoolId])`. Duplication is prevented upstream, by
`familyGateway.searchByName`, `personGateway.searchByName` and `paymentGateway.findByReference` —
all narrow projections, because a model's context has no business holding `healthNotes` or an
address.

**The lock is single-pass**: `claim()` is a conditional `updateMany` on `(id, schoolId, owner, tool,
checksum, status: PENDING, expiresAt > now)`, never a read followed by a write. A client that
retries after a network cut must see exactly one commit win; the loser re-reads the draft and
returns the **recorded result**, which is the correct answer to a replay, not a second family.

**A draft belongs to the identity that proposed it, and that identity is discriminated.**
`McpDraft.ownerKind` is `MCP_KEY`, `ADMIN_SESSION` or `OAUTH_GRANT`, with exactly one of `keyId`,
`userId` or `grantId` set (`McpDraft_owner_check`, migration `20260925160000_add_mcp_draft_owner`,
widened by `20260929090100_widen_mcp_draft_owner_check` once `20260929090000_add_mcp_oauth`
has committed the enum value; the rows that existed before the first were all
backfilled as `MCP_KEY`). The owner is part of the claim condition (`DraftOwner`,
`src/domain/mcp-draft.ts`), and a draft presented by another key, another administrator, another
connection, or the same person through another access mode is refused as `draftNotFound` rather
than as forbidden. A bare identifier would not do: a `userId`, a `keyId` and a `grantId` never
collide by construction today, but a key revoked and its user's session are still two distinct
authorities, and a plan validated under one must not be engaged under the other. The AI assistant
(*AI assistant* below) is the `ADMIN_SESSION` owner; it calls the MCP's preview and commit use cases
with the same `DraftScope`, so the checksum, the expiry, the lock and every
commit-time re-check are the MCP's. The resolved plan freezes the proposing user in `createdById`:
without that binding, a revoked key's plan would still land, signed by its owner.

**The lock always has an exit.** The result is written by the same transaction that writes the data,
so a `COMMITTED` draft with a null `result` provably wrote nothing. A refusal returned from inside
that transaction aborts it (`commitInTransaction` raises it and hands the string back outside), so
whatever the commit wrote before refusing is rolled back too — Prisma would otherwise commit an
interactive transaction whose callback merely returned. Two ways out follow from that: a
commit that refuses on a business rule, or throws, calls `release()` and hands the lock back at once;
one killed between the claim and the transaction is reclaimable after
`MCP_DRAFT_COMMIT_TIMEOUT_SECONDS` (60 s, `src/domain/mcp-draft.ts`) through `reclaim()`, which
re-dates the lock under the same conditions as `claim()`. Without it a dead process would pin a draft
on `commitInProgress` forever, and an agent that gave up would re-preview and write twice.

**A draft does not outlive its usefulness.** `resolved` holds the raw reading of a photographed
form — student names, birthdays, parent phone numbers — so an expired `PENDING` draft, one no human
ever validated, is deleted as soon as it expires. A `COMMITTED` draft keeps its `result`, the only
correct answer to a late replay, for **seven days past its expiry**
(`MCP_DRAFT_COMMITTED_RETENTION_DAYS`, `src/domain/mcp-draft.ts`); after that the agent has given up
and the business write lives elsewhere. The committed branch requires **both** `expiresAt` and
`committedAt` past the retention: `reclaim()` re-dates an abandoned lock without looking at the
expiry, so a draft expired eight days ago can be committed right now, and deleting it would tear the
row out from under its transaction. Both branches filter on `expiresAt`, which is what finally gives
`@@index([expiresAt])` a consumer.

The sweep has no clock of its own. `purgeExpiredDrafts()`
(`src/use-cases/mcp/purge-expired-drafts.ts`) runs from `POST /api/mcp` through `after()`, off the
response path, at most once every `MCP_DRAFT_PURGE_INTERVAL_MINUTES` (15 min) per process. It is
registered **before the platform flag**: retention does not depend on the service being open, or
closing the MCP would freeze the sweep while personal data keeps expiring. No scheduler is deployed
with this application, and a maintenance route would wait for a caller that does not exist;
the two routes that create drafts, `POST /api/mcp` and the assistant's `POST /api/ai/assistant`,
are the only available clocks. Like the rate-limit counters, the interval is in-process: horizontal scaling multiplies the
sweeps, which an idempotent `deleteMany` does not mind.

The delete itself is a named tenant-guard exception, `purgeExpiredMcpDrafts` in
`src/lib/db-unscoped.ts`, called by `mcpDraftGateway.purgeExpired` — which remains the model's single
boundary. A retention sweep has no `schoolId` to offer, and the guard rejects an unscoped
`deleteMany` on `db`; enumerating the schools to delete school by school would describe nothing the
rows still belong to.

`commit_enroll_family` owns **one `db.$transaction`** with direct `tx.*` calls, like
`create-enrollment.ts`: no gateway accepts an injected client, and chaining the four use cases would
leave an orphan family behind the first failure. Before re-reading anything it takes, in order, the
(school, student, period) lock of each existing student it enrolls, then the row lock of each class
it seats children in, by increasing id (`reserveClassSeatsInOrder`); the capacity and duplicate
checks that follow therefore cannot race a dashboard enrollment.

| Body | Cause |
|---|---|
| `validationError` | malformed `draftId`/`checksum`, or a stored plan of an older shape |
| `draftNotFound` | unknown draft, one belonging to the other tool, or one proposed by another owner (key, administrator, or access mode) |
| `draftExpired` | past the thirty minutes |
| `checksumMismatch` | the checksum does not match the plan that was shown |
| `commitInProgress` | a concurrent commit is still inside its transaction, and under 60 s old |
| `notFound` | the class the preview resolved no longer exists, or the family, member, enrollment or plan it targets |
| `classFull` | the class filled up between the preview and the commit, counted under the class row lock |
| `duplicateEnrollment` | a member of the existing family was enrolled between the preview and the commit |
| `overpayment` / `noPayableEnrollments` / `refundExceedsPaid` | the fresh balances refuse the amount |
| `staleDraft` | the recomputed split no longer matches the validated one, the enrollment or plan changed, or a member became a student |
| `totalBelowPaid` | a payment banked since the preview exceeds the enrollment's new total |
| `teacherNotFound` | a teacher of a planning is no longer assigned to its class |
| `classOverlap` / `teacherOverlap` | a slot of a planning now overlaps one written since the preview |

A refusal writes nothing and unlocks the draft, so the caller may fix the cause or preview again
without waiting out the timeout.

**A correction is its own pair.** `update_enrollment` (`src/use-cases/mcp/preview-update-enrollment.ts`)
changes the plan and/or the discount of one `PENDING` or `ACTIVE` enrollment, so a child entered on
the wrong plan is fixed without the dashboard. It applies the dashboard's money rule —
`totalAmount = plan.amount - discount`, on the target plan's **current** price — and keeps the
enrollment's discount when none is read, because changing plan must not silently erase one. Payments
stay where they are. **The new total never falls below what the enrollment already banked** →
`totalBelowPaid`, since a balance never goes negative and an overpayment nobody decided to refund
must not appear. A request that changes nothing → `noChange`; several open enrollments for the
student → `ambiguousEnrollment`, listed so the caller retries with `enrollmentId`. The commit
compares the enrollment's current plan, discount and total to the validated `before`, and the target
plan's price to the validated `after` → `staleDraft` when either moved.

**An existing family is named by `familyId`, instead of `familyName`.** A child entered on the
dashboard without an enrollment — a sibling added to the family, never enrolled — must not come back
as a second student of the same name. Each student line is looked up among the family's non-parent
members (`familyGateway.findMembersForMcp`), equality first then substring, like `matchByName` — a
parent never becomes a student through a sheet line. A member found is enrolled as is, its name, sex and birthday left untouched; a line matching no member creates
the child in that family. Two members for one line → `ambiguousStudent`; a member already holding a
`PENDING` or `ACTIVE` enrollment → `duplicateEnrollment`; an unknown family → `notFound` on
`familyId`. `familyId` excludes `familyName`, `parents` and the emergency contact → `validationError`,
since the family already owns them. The commit rereads the family and each member before the first
write (`src/use-cases/mcp/commit-enroll-family.ts`): archived family or member gone → `notFound`,
a student created since → `staleDraft`, an enrollment opened since → `duplicateEnrollment`.

**A whole planning is one write.** `class_schedule` (`src/use-cases/mcp/preview-class-schedule.ts`,
`commit-class-schedule.ts`) enters every slot of a period's weekly planning at once, because a
weekend read off one photograph must never be half-written: a slot refused after ten were created
would leave a planning nobody dictated. The preview resolves each line's class among the classes of
the named period and each teacher among the teachers **assigned to that class** — `notFound`,
`ambiguousClass`, `ambiguousTeacher`, `teacherNotAssigned` — applies the dashboard's slot rules
(`invalidTimeRange`, `classOverlap`, `teacherOverlap` as a warning unless
`class_schedule_teacher_overlap_allowed` is `false`), and refuses a line that repeats an earlier one
(`duplicateSlot`) or a slot already in the period (`alreadyExists`). Teacher overlaps are probed
across the whole school, as the gateway refuses them. The commit rereads the classes and
assignments in its transaction (`notFound`, `teacherNotFound`), takes every class and teacher
advisory lock of the batch sorted before the first write, then writes the slots one by one through
the dashboard's overlap checks (`classScheduleGateway.createManyWithOverlapValidation`); the first
`classOverlap` or `teacherOverlap` is returned as a refusal, which aborts the transaction and takes
the slots written before it away with it. The transaction timeout grows with the batch (5 s plus
250 ms a slot), since a hundred lines cost three queries each. The recorded result lists each slot `id`
with its teacher-overlap warnings, so a replay returns the same planning instead of a second one.

**An expense note is read before it is written.** `record_teacher_expense`
(`src/use-cases/mcp/preview-record-teacher-expense.ts`, `commit-record-teacher-expense.ts`) enters a
teacher expense note read off a receipt, so the human rereads the teacher, amount and dates before the
financial write. Both halves refuse `notConfigured` unless `teacher_expenses_enabled` is on; the
commit checks it before claiming, so a draft prepared before the switch cannot be committed after it.
The preview resolves `teacherName` among the school's active teachers with the planning's matching
rule (`matchTeacher`: full name in either order, first or last name, then substring) → `notFound`,
`ambiguousTeacher`; a `teacherId` outside the school or archived is `notFound`. Dates are calendar
days stored at midnight UTC, as the dashboard form does, and `requestedAt` defaults to today. Two
findings are warnings, not refusals, because the dashboard accepts both: an active note of the same
teacher, amount and day (`possibleDuplicateExpense`) and `paidAt` before `requestedAt`
(`paidBeforeRequested`). The commit rereads the teacher in its transaction (`notFound` when archived
since) and records the note with its result, so a replay returns the same note instead of a second one.

**The two pairs chain.** `enroll_family` creates its enrollments `PENDING`, and `record_payment`
distributes across `PENDING` and `ACTIVE` ones alike — so a family enrolled through the MCP can pay
its next instalment before an admin validates the enrollment. Validation stays a dashboard decision;
collecting money does not wait for it.

These discriminants answer an agent, not a dialog, so they carry no `messages/*.json` entry — the
rule in [Surfacing a rule in the UI](#surfacing-a-rule-in-the-ui) applies to screens.

## AI assistant (OpenRouter)

An administrator's chat with a model on OpenRouter, available as a floating panel on every
dashboard page and full-width at `/dashboard/enroll-assistant`, both backed by `POST /api/ai/assistant`.
It reads the school and proposes changes through the MCP's tools; `docs/ai-assistant.md` documents
the operator side. Unlike the MCP, **a photo does reach the server** — it has to, the model is
called from here — but it never reaches storage.

**Two platform settings, on purpose distinct.** `ai_assistant_enabled` opens the assistant for the
whole instance and, like `mcp_enabled`, **reads as disabled when absent** (`readsAsOptedIn`).
`openrouter_api_key` is the provider key. Both are written from the **Integrations** section of
`/dashboard/config`, rendered for a super-admin only and written behind `requirePlatformAdmin()`.
Turning the assistant off does not delete the key, and entering the key does not open the assistant;
an operator can therefore provision the key on a Friday and open the feature on Monday. A school
administrator uses the assistant when it is open and never sees, reads or changes the key.

**The key is encrypted at rest.** `PlatformSetting.value` is plain text, and a provider key has no
business in clear in a database dump. `setOpenRouterApiKey` stores `encryptSecret(key)`
(`src/lib/secret-crypto.ts`, AES-256-GCM, random IV per write, authenticated tag) under a 32-byte
`SETTINGS_ENCRYPTION_KEY` that lives in the environment only. The dashboard never returns the
stored value — only `configured`, `notConfigured`, or `unreadable` — and the key is decrypted solely
inside the chat route, at the moment the provider client is built. `unreadable` covers a value
written under another environment key as well as a corrupted row: in both cases the secret is lost
to the application and the only way out is to enter it again. Without `SETTINGS_ENCRYPTION_KEY` the
form refuses to save (`secretStorageNotConfigured`) rather than falling back to clear text.

**Every turn re-checks the door.** The route starts from the session (an `ADMIN` or a super-admin
in the active school; a parent or a teacher is refused), then the `ai_assistant_enabled` flag, then
the key, on every turn — including the turn that carries an approval, so a write approved after the
flag was cut does not run. The page returns `notFound()` when the flag is off, and the sidebar entry
(`feature: 'aiAssistant'`) disappears with it. `proxy.ts` excludes `/api`, so the route guards
itself, and it also refuses a cross-origin JSON post (`isSameOriginJsonRequest`) — a session cookie
is not a bearer token for a third-party page. The `key={schoolId}` on the chat remounts it on a
school switch: the conversation and the photos do not follow the administrator into another school.

**Photos are bounded, rewritten and forgotten.** The client accepts PNG, JPEG and WebP only, at most
`maxImagesPerMessage` per message and `maxImagesPerRequest` across the conversation it resends,
`maxImageBytes` each (`AI_ASSISTANT_LIMITS`, `src/domain/ai-assistant.ts`); the server re-checks all
of it because the client is not trusted. Each photo is a `data:` URL — the route never downloads a
URL the model or the client names — and `sanitizeImage` decodes it with sharp under a pixel ceiling,
applies the EXIF rotation, drops every metadata block, caps the longest side and re-encodes to WebP,
in memory. Nothing goes through `/api/media` or the object store, and no photo is persisted. The chat
panel says so, and names the model, before the first send.

**Conversations are kept, per administrator and school, without photos.** When a turn finishes, the
route saves the whole conversation as one `AiConversation` row (`saveConversation`,
`src/use-cases/ai-assistant/save-conversation.ts`): the id is the client's `z.uuid()`, the title is
the first user text capped at 80 characters, and every photo part is replaced by `[photo: name]`
before it reaches the database. The row is scoped by `schoolId` (tenant guard) and `userId`; save,
list, open and delete all filter on both, so an id guessed from another administrator matches
nothing and a save on it fails instead of overwriting. The history lists the 30 most recent; there
is no automatic purge, and deleting a school or a user cascades. A failed save is logged and never
breaks the answer already streamed.

**Dictation stays a browser feature.** The panel's *Dicter* button drives the browser's Web Speech
API (`useDictation`) and only fills the input; nothing is sent until the administrator sends it.
The audio goes to the browser vendor's speech service, not to this server or to OpenRouter, and the
button is absent where the API is (Firefox). The locale picks `fr-FR` or `en-US`.
The `Permissions-Policy` header in `next.config.ts` allows `microphone=(self)` for this; camera and
geolocation stay blocked. With `microphone=()` the browser refuses without showing its prompt.

**The model is chosen server-side from a closed list.** `AI_ASSISTANT_MODELS` holds models known to
read an image and call a tool; `AI_ASSISTANT_MODEL` may pick one of them and anything else falls back
to the default (`resolveAiAssistantModel`). A free identifier would let an operator point at a
text-only model, and the failure would surface at the first photo. The default is the cheapest of
the list; which one reads real sheets best is an open point to settle on real forms, not here.

**Failures are named, localized and write nothing.** The route answers a typed code — `forbiddenFile`
(415), `imageTooLarge` (413), `unreadableImage` (422), `tooManyImages`, `tooManyMessages`,
`messageTooLong` (400), `tooManyRequests` (429, `requestsPerMinute` per administrator and school),
`aiAssistantDisabled` and `aiAssistantNotConfigured` (503) — and a provider failure in the stream is
mapped by `toProviderErrorCode` to `timeout`, `quotaExceeded`, `invalidKey`, `providerRateLimited`
or `providerError`; the raw provider message stays in the server log. None of these touches a
business row.

**One catalog, two surfaces.** The model's tools are `listSchoolTools(scope)`
(`src/mcp/school-tools.ts`), the same list `buildMcpServer` registers, built with an
`ADMIN_SESSION` `DraftScope` for the administrator and the active school. Every tenant guard,
preview/commit re-check and draft rule of the MCP therefore applies unchanged; a typed refusal
reaches the model as `{ error }` and an unexpected throw as `{ error: 'internalError' }`, with the
detail in the server log.

**A write runs only after a signed human approval.** Tools of kind `write` are declared
`user-approval`: the stream stops on the call, the panel shows its input, and the tool executes only
when the administrator validates. Because the browser resends the whole conversation, each approval
is HMAC-signed by the server (`experimental_toolApprovalSecret`, derived from `BETTER_AUTH_SECRET`)
and the signature is verified when it comes back; a client cannot forge an approval. Without
`BETTER_AUTH_SECRET` the write tools are denied outright (`approvalUnavailable`) rather than trusted.
A refused write is not retried by the model. The panel labels the refusal *Annuler*.

**Payments default, then ask nothing.** `preview_record_payment` takes the family as `familyId`,
`studentId` (the student's families; several → `ambiguousFamily`) or `familyName`. Without an
`amount` it pays the family's whole remaining balance (half-up rounded), and a balance of zero blocks
with `nothingDue`; without a `method` it is `CASH`; without `paidAt` it is today. The system prompt
tells the model to use the id of the page it is on ("this student") and go straight to the preview
then the commit: the approval card is the confirmation. The route does not leave that to the
model: after a preview that returns a `draftId` and no blocker, `prepareStep` forces the matching
`commit_*` as the next step (`commitAfterPreview`), so no "do you confirm?" is ever asked in text.
The card then shows the preview's resolved plan (for a payment: family, amount, method, date) above
the raw `draftId`/`checksum` it will send.

**A new teacher needs a name, nothing else.** `create_teacher` (write, approval required) creates the
teacher with no class and no period, like the dashboard form; assigning a class is a separate step.
An active teacher of the same school with the same name, in either order, or the same email
(`teacherGateway.findPossibleDuplicates`, case-insensitive) suspends the creation: the tool answers
`possibleDuplicate` with the matches' identity and writes nothing, and `allowDuplicate: true` creates
the homonym once the administrator says it is someone else. The check is advisory, not a lock: two
concurrent calls for the same name can both create. The dashboard form does not check.
The assistant's prompt carries the current period (`getSelectedPeriod`: the selected-period cookie,
else the period covering today), so whenever a period is needed and none is given, the model uses
that one instead of asking.

**Undoing a manual payment.** `cancel_payments` (write, approval required) deactivates payments by id
— the soft deletion every payment read already respects, so balances fall back at once. All ids must
be active manual payments of one family: missing → `notFound`, a Stripe payment → `onlinePayment`,
two families → `mixedFamilies`. It takes the family payment lock, rereads the payments under it
(`notFound` if one vanished meanwhile), then deactivates them in the same transaction.
`get_family_payments` lists a family's active payments so the model can find the ids.

**Bounded agent loop.** One turn runs at most `maxAgentSteps` tool steps within `agentTimeoutMs`;
replayed tool results share a `maxToolReplayChars` budget, and only settled calls (done, error,
denied, or answered approval) are replayed. The current page path is passed as a hint only after
matching a strict path pattern; it scopes nothing.

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
  sent, payment transactions initiated, machine API keys held, OAuth connections granted
  (`hasRelatedRecords`). The dialog also requires the target's email to be typed back; a mismatch
  answers `confirmationMismatch`. Sessions, accounts, passkeys and family links cascade with the
  row; `McpApiKey` and `McpOAuthGrant` deliberately do not.
  Self-service deletion (`deleteProfile`, from `/dashboard/settings`) counts the same blockers
  through `countUserDeletionBlockers` and answers the same `hasRelatedRecords`, so neither path can
  reach the foreign key and fail raw.
- **Email uniqueness is checked before an update**, including against archived accounts
  (`emailAlreadyUsed`).
- **`User.email` is only ever written in lower case.** Every writer normalizes at its own boundary:
  `updateUserSchema.email` and `CreateUserSchema.email`, which never reach Better Auth in the update
  case, and `normalizeEmail(invitation.email)` on the account created by invitation acceptance. The
  rule is not cosmetic — `User.email @unique` is case sensitive in Postgres, so two accounts
  differing only by case fit under the index, and the `emailAlreadyUsed` guard of `updateUser`, an
  exact `findUnique`, would not see the collision. Normalizing every writer closes that: the guard's
  needle comes from `parsed.data`, hence already lowered, and nothing new can be written in mixed
  case. Editing a row written before the rule rewrites it in lower case as a side effect.
- **Passwords are never set by an administrator.** `sendPasswordResetAction` triggers the Better
  Auth reset email; the user chooses their own password. It refuses an archived account.
- **Assigning `SUPER_ADMIN` is reserved to a super admin** (`canAssignRole`), so the policy holds
  even if the use case is ever reached by another caller.
- **An address changed by an administrator is re-verified, and loses its verified flag.**
  `updateUserAction` compares the stored address with the submitted one; when they differ it forces
  `emailVerified: false` into the update and calls `auth.api.sendVerificationEmail` on the new
  address. The « email vérifié » checkbox of the drawer cannot arbitrate this: it is pre-checked
  from the stored value and resubmitted untouched, so keying the decision on it would silently skip
  re-verification for exactly the accounts that were already verified, and leave the flag
  describing an address nobody ever confirmed. This is the only path that writes a sign-in address
  nobody has proven access to — an invited account received its token on that address, and
  `createUserAction` marks `emailVerified` itself — which is why no verification mail is sent on
  sign-up (`emailVerification.sendOnSignUp` is false). A failed send never fails the update: the
  account already carries the new address.
- **A user changes their own address through a confirmation on the old one.** `changeEmailAction`
  (`/dashboard/settings`, Account tab) calls `auth.api.changeEmail`; `User.email` is only rewritten
  once the link mailed to the **current** address is followed, so a hijacked session cannot move the
  account to an attacker's address. Better Auth answers success without mailing anything when the
  target address already exists, deliberately: the form must not become an account-existence oracle,
  and the screen shows the same "check your inbox" message either way.

### Transactional e-mail

Every message is rendered by the shared layout in `src/lib/email-template.ts` — table markup, inline
styles, Outlook VML button, hidden preheader, plain-text twin — and carries the school palette of
`src/lib/theme.ts`. Values interpolated into the HTML are escaped and link targets restricted to
`http(s)`, because school names and URLs reach the template from user input.

- **School-signed messages** name the school as sender: invitation (`emails.invitation`) and its
  resend, which uses the distinct `emails.invitationReminder` copy — `resendInvitationAction` issues
  a new token, so the reminder must say the previous link no longer works.
- **Platform-signed messages** go through `sendPlatformEmail` (`src/lib/platform-email.ts`) and are
  branded « Education »: password reset, address verification, address-change confirmation. Their
  Better Auth callbacks receive no request locale and no school context — an account may belong to
  several schools — so their copy is French in source rather than translated.
- **A password change notifies its owner.** `changePasswordAction` mails `emails.passwordChanged`
  after the change succeeded. The send is deliberately not part of the result: the password is
  already replaced, and reporting a mail failure would invite the user to change it twice.

### Impersonation

A super admin can sign in as another account from the drawer (« Se connecter en tant que ») to see
exactly what that user sees. The mechanism is the Better Auth `admin` plugin's, rebuilt without its
roles in `src/lib/impersonation.ts`; the guard is `checkImpersonation` in `src/domain/user.ts`.

- **The right is read from `User.isSuperAdmin`, in the database**, for both the actor and the target.
  Only `/admin/impersonate-user` and `/admin/stop-impersonating` exist; no other `/admin/*` route of
  the upstream plugin is exposed.
- **Refusals:** an actor that is not an active super admin (`notSuperAdmin`), an impersonation
  started from an impersonated session (`alreadyImpersonating`), yourself (`cannotTargetSelf`),
  another super admin (`targetIsSuperAdmin`), an archived account (`targetInactive`).
- **The borrowed session lasts one hour** and carries `Session.impersonatedBy`. The original session
  token is kept in the signed `admin_session` cookie; stopping deletes the borrowed session and
  restores the original one only if it still belongs to `impersonatedBy`.
- **Authorization follows the target.** `getSchoolContext()` resolves the borrowed session like any
  other: an impersonated parent is confined to their family, the admin's `active_school` cookie is
  honoured only if the target may use that school.
- **Writes are attributed to the target.** A business mutation made while impersonating is recorded
  as the target's own (`createdBy`, `paymentInitiatedBy`). The dashboard shows a banner with
  « Revenir à mon compte » for the whole borrowed session.
- **Credentials and the account itself are locked** (`impersonating`, tested by `isImpersonating` in
  `src/domain/user.ts`): passkey registration and deletion, profile update (`updateProfileAction`:
  name, bio, image), email change, password change, account deletion, session revocation and MCP
  key creation or revocation. The server actions return the typed discriminant, shown as
  `errors.impersonating` in settings; the plugin's `before` hook also answers 403 `impersonating`
  on the native Better Auth routes listed in `IMPERSONATION_LOCKED_AUTH_PATHS` (change/set password,
  change email, update user, delete user, revoke session(s), link/unlink social, access and refresh
  tokens), for HTTP and `auth.api` alike.
- **Every impersonation leaves a durable trace** in `ImpersonationLog`: actor and target (id and
  email snapshot), borrowed session id, IP, user agent, start and planned expiry. The row is written
  in the same request, before any cookie is set; if the write fails the borrowed session is deleted
  and the impersonation refused. Stop and sign-out of the borrowed session set `endedAt`. A failure
  to close the row on sign-out is logged and never blocks the sign-out: the borrowed session is
  still deleted. A session that expires, is revoked otherwise, or whose sign-out could not close the
  row keeps `endedAt` null and `expiresAt` bounds it. The table has
  no foreign key to `User`, so the trace outlives an account deletion.

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
- **Overlap is checked within one school.** `checkOverlap` is a pure function; the rows it compares
  come from `periodGateway.checkOverlap(schoolId, …)`, so two schools may hold the same school year.
- **The selected period is validated for existence *and* membership.** `selected_period` is a cookie
  and survives a school switch, so `getSelectedPeriod(schoolId)` constrains both queries by
  `schoolId` (`src/features/dashboard/period.ts`). A cookie naming another school's period is
  treated as absent and the default selection applies — otherwise a period of school A would filter
  school B's data. `schoolId` is a required parameter, not derived inside, so the type-checker
  enumerates every caller.

## Levels

Owner: `src/domain/level.ts`, `src/use-cases/levels/`.

- `nextLevelId` chains levels into a progression. Its unique constraint is the composite
  `(nextLevelId, schoolId)`: two levels of one school cannot share a successor, and the chain cannot
  cross a school boundary.
- **No cycles.** Walking the chain from the candidate successor must never return to the level being
  edited, and a level cannot point at itself → `circularReference`. The walk also stops on a
  repeated node, so a pre-existing cycle elsewhere cannot hang the check.
- **A level holding classes cannot be archived** → `levelInUse`.
- **Active level names are unique within a school** → `nameTaken`. `createLevel` and `renameLevel`
  look up an active homonym (`levelGateway.findActiveByName`) before writing; a rename keeps its own
  name. The partial unique index `Level(schoolId, name) WHERE isActive` settles concurrent writes,
  and its P2002 is mapped to the same `nameTaken`. An archived level's name can be reused.
- **The cycle walk only sees one school's levels.** `checkCircularReference` is pure; its map is
  built from `levelGateway.list(schoolId)` in `src/use-cases/levels/set-next-level.ts`.

## Classes

Owner: `src/domain/class-period.ts`, `src/use-cases/class-periods/`.

- **Capacity is per class**, stored on `ClassPeriod.capacity`, required at creation and a positive
  integer. The `max_students_per_class` config only supplies the default value in the creation form,
  and `setConfig` accepts it only as an integer of at least 1 (`/^\d+$/`, >= 1) → `invalidNumber`
  otherwise (negative, zero, decimal, empty or exponent notation); the config form enforces
  `min=1 step=1`.
- **The class detail page is admin-only**, so class names appear as plain text, not links, on the
  pages parents can open (family child card and menu, dashboard recent enrollments, enrollment
  detail).
- **One active class per level and period.** Creation and a level change both check the active class
  already assigned to `(schoolId, levelId, periodId)` and return `levelAlreadyAssigned` before any
  write. Saving a class without changing its level skips that check so legacy duplicates remain
  editable and can be repaired from the class form instead of being locked in place.
- **A class is full** when `currentEnrolled >= capacity` → `classFull`.
- **Capacity cannot drop below current occupancy** → `capacityBelowEnrolled`.
- **A class can only be archived while it is unused** → `classInUse` when it has any student
  assignment, teacher assignment, schedule slot, or attendance session. Archiving is a soft delete
  (`isActive: false`), so an identifier outside the active school scope reads as `notFound`.
- **Occupancy counts** assignments with `endAt: null` whose enrollment is `PENDING`, `ACTIVE` or
  `COMPLETED`. Cancelled enrollments free their seat; completed ones do not. One predicate
  (`SEAT_HOLDING_ENROLLMENT_STATUSES` in `src/domain/class-period.ts`,
  `seatHoldingAssignmentsWhere` in `src/gateways/class-seat-lock.ts`) serves every reader and
  writer: the class pages, the dashboard insights, the MCP preview and commit, promotion, creation
  and reassignment.
- **Every write that takes a seat reserves it under a class row lock.** `reserveClassSeats`
  (`src/gateways/class-seat-lock.ts`) runs `SELECT … FOR UPDATE` on the active `ClassPeriod` row of
  the school, then re-counts occupancy in the same transaction: a concurrent writer waits for the
  commit and counts the seat it took, so a class never ends above its capacity. Creation, creation
  with a new student, reassignment, promotion and the MCP commit all go through it; a class archived
  meanwhile answers `notFound`. **Lock order is fixed**: the (school, student, period) advisory lock
  first, then the enrollment row, then class rows by increasing id (`reserveClassSeatsInOrder`), so
  two writers never wait on each other in a cycle.
- **Teachers are many-to-many.** A `ClassPeriod` may have no teacher yet, one teacher, or several
  teachers through `ClassPeriodTeacher`. Teacher assignments are scoped by the same `schoolId` as the
  class and the teacher; cross-school class staffing is rejected by composite foreign keys and by the
  class use cases.
- **Editing a class only replaces active-teacher assignments.** A submitted `teacherIds` list can
  only ever contain active teachers (deactivated teachers are never offered as form options), so
  `classPeriodGateway.update` scopes its assignment sweep to `teacher: { isActive: true }`. A
  deactivated teacher's `ClassPeriodTeacher` row survives any class edit instead of being silently
  destroyed.
- **A deactivated teacher's stray assignment is removable, explicitly, and only that one.** The
  class detail page reads `ClassPeriodTeacher` rows through
  `classPeriodGateway.listInactiveTeacherAssignments`, which — unlike `findById` — filters
  `teacher: { isActive: false }` instead of excluding them, so a deactivated teacher's row is
  surfaced there instead of staying invisible. `unassignClassPeriodTeacher`
  (`src/use-cases/class-periods/unassign-teacher.ts`) is the only path that deletes such a row,
  through `classPeriodGateway.unassignTeacher`. The restriction to inactive teachers is enforced in
  that gateway call's `where` — `{ schoolId, classPeriodId, teacherId, teacher: { isActive: false } }`
  — not only by the page hiding the button next to an active one: calling the action directly on an
  active teacher's assignment deletes nothing (`count` stays 0, same as a missing assignment). This
  keeps `classPeriodGateway.update` the sole path that ever touches an active-teacher assignment.

## Teacher access

Owner: `src/lib/school-context.ts`, `app/[locale]/(dashboard)/_lib/auth-helper.ts`.

- An active `Teacher` profile linked to a user in the same school grants teacher capability. It can complement an existing `ADMIN` or `PARENT` membership, or accompany a `TEACHER`-only membership.
- Its dashboard surfaces are **My classes** and **Attendance tracking**. Both are scoped by the school and current profile's active `ClassPeriodTeacher` assignments; removing an assignment removes that class and its attendance access immediately.
- A `TEACHER`-only member entering `/dashboard` is redirected to **My classes**. A parent who also has teacher capability retains the parent dashboard, as do school and platform administrators.
- A teacher invitation names the unlinked teacher profile and binds it atomically when accepted. Revoking teacher access unlinks that profile without changing an ADMIN/PARENT membership; for a `TEACHER`-only member, it also removes the now-capabilityless membership. Removing any school membership clears the profile link, revoking access and making the profile available for a replacement.
- Teacher memberships never authorize families, payments, users, configuration, classes administration, or other schools.
- **Archiving a teacher preserves history** (`isActive: false`) while clearing `Teacher.userId` and
  removing a `TEACHER`-only school membership. Existing class, planning, expense, and invitation
  rows remain attached and therefore auditable.
- **Permanent deletion is limited to an unused teacher** → `teacherInUse` when the teacher still has
  account access, a class or schedule assignment, an expense, or an invitation.

## Attendance

Owner: `src/domain/attendance-session.ts` (roster window, transitions),
`app/[locale]/(dashboard)/_lib/attendance-actions.ts` (persistence).

- `attendance_enabled` is opt-in per school. When off, attendance links and pages are hidden and every server mutation refuses it, including cancelling or restoring a session and cancelling a planned occurrence (`attendanceDisabled`).
- A logical occurrence is unique by school, class, date and a non-null occurrence key (`adhoc` or the schedule-slot id). Opening is an atomic upsert; its roster snapshots the active class assignments of that **UTC calendar day**: an assignment counts when it starts before the next UTC midnight and has not ended before that day's midnight (`attendanceRosterWindow`). A student assigned during the day, even after midnight, is therefore on that day's call.
- **A DRAFT session can take students assigned since its opening** (`refreshAttendanceRosterAction`, "Refresh student list" in the attendance panel). It only adds entries (`NOT_RECORDED`) for roster students without one and never removes or rewrites an existing entry. The refresh row-locks the session with a write conditional on `DRAFT`; a VALIDATED or concurrently validated session → `invalidTransition`, a cancelled one → `sessionCancelled`.
- **Validation is a conditional write** (`validateAttendanceAction`). It applies only while the session is still `DRAFT` or `VALIDATED` (re-validating after a correction); a session cancelled between the read and the write is left untouched → `invalidTransition`, rather than silently revived as VALIDATED.
- **Cancel and restore are conditional transitions** (`planCancellationTransition`). Cancelling an active session records its status in `statusBeforeCancellation` and only applies while the session still has the status that was read; cancelling an already cancelled session is a no-op. Restoring applies only to a session that is still `CANCELLED` (with the same saved status) and returns the saved status, or DRAFT (clearing `validatedAt`) when none was saved; an empty cancelled placeholder is deleted instead. Restoring a DRAFT or VALIDATED session, or losing a race with another change (stale tab, double click), writes nothing → `invalidTransition`.
- The attendance route identifies a planned occurrence explicitly with its UTC calendar `date` and `slotId`; an exceptional occurrence uses `date` and `occurrence=adhoc`. Loading either identity only reads an existing session: creating a planned or exceptional session remains an explicit mutation. A slot must belong to the class and school **and** match the selected date's planning weekday (Monday 1 through Sunday 7).
- Entries remain `NOT_RECORDED`, `PRESENT`, `ABSENT` or `LATE`; **All present** changes only the first state. A late entry may carry zero to 1,440 optional whole minutes and an internal optional message of at most 1,000 characters; it never notifies a parent. Changing to any other status clears late minutes while preserving its message. A validated session can be corrected and records the latest author and timestamp.
- ADMIN may operate school classes. A teacher capability is restricted server-side to their own `ClassPeriodTeacher` assignments.
- Tracking derives expected occurrences from weekly slots for the selected **UTC calendar date** (the explicit V1 school-time convention). A slot absent from that day's planning creates no missing call.
- Closures, cancellations and one-off timetable exceptions are represented as excluded slot ids before occurrence generation. They therefore suppress an expected occurrence rather than displaying a false `NOT_STARTED` state.
- **Cancelling a scheduled or ad hoc session asks for an explicit confirmation** (`ConfirmDialog` in
  `app/[locale]/(dashboard)/dashboard/attendance/_components/cancel-attendance-form.tsx`). Restoring
  a cancelled session needs no confirmation.
- **Late minutes are a whole number from 0 to 1,440.** The client checks it with `parseLateMinutes` /
  `MAX_LATE_MINUTES` in
  `app/[locale]/(dashboard)/dashboard/my-classes/[id]/attendance/_components/student-attendance-card.tsx`
  and never sends an invalid value; the server applies the same limit through the Zod `updateSchema`
  in `app/[locale]/(dashboard)/_lib/attendance-actions.ts`.
- **The return link after validation depends on who validated.** An admin goes back to
  `/dashboard/attendance` for the same day; a teacher goes back to `/dashboard/my-classes`, because
  that page requires a teacher record.
- **The MCP reads the tracking, never a roster.** `list_attendance_calls`
  (`src/use-cases/mcp/list-attendance-calls.ts`) applies the same derivation as
  `/dashboard/attendance` — active classes of a period, UTC days, closures keeping only opened calls —
  over at most 31 days (`MCP_ATTENDANCE_RANGE_MAX_DAYS`). It publishes each call's class, slot, status
  and session id, not its students or entries, and is refused with `notConfigured` when
  `attendance_enabled` is off.
- **Attendance entries do not outlive their student.** Deleting a family for good removes its own
  students' entries, even on a validated session; the session and its other entries stay (see
  « Deleting a family for good »).

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

Atomic in one `db.$transaction`: the duplicate guard, the capacity count, the enrollment, and the
class assignment (`src/use-cases/enrollments/create-enrollment.ts`).

- Student, plan and class must all exist → `notFound`.
- **One `PENDING` or `ACTIVE` enrollment per student per period** → `duplicateEnrollment`. The guard
  is read inside the transaction, after a transaction-scoped advisory lock on (school, student,
  period) (`enrollmentGateway.lockStudentInPeriod`), so two concurrent creations for the same
  student cannot both find the period free. No unique index can carry this rule: the period lives
  on the assignment's class, not on `Enrollment`. A `COMPLETED` enrollment leaves re-enrollment
  open.
- **Capacity is re-counted inside the transaction, under the class row lock** (`reserveClassSeats`,
  see Classes), so two concurrent enrollments of different students cannot both take the last seat
  → `classFull`. With `replaceExisting`, a refused seat throws to roll back the cancellation of the
  previous enrollment, since a `return` would commit it.
- **Three entry points for a school admin**: the enrollments list (`/dashboard/enrollments`,
  « Nouvelle inscription », any active student of the school), the students list, and the family
  and student detail pages. On every one, the amount due is prefilled with the selected plan's
  price.
- `createEnrollmentAction` returns only `{ id }` on success, or a typed error code string on
  failure.

### Creating an already enrolled student

« Ajouter un élève » in a family enrolls the child in the same gesture when the enrollment
section is kept ticked: `src/use-cases/students/create-enrolled-student.ts` writes the person,
the family link, the student, the enrollment and the class assignment in **one**
`db.$transaction`, with the same locked capacity re-count. A refusal — `notFound`,
`discountExceedsPlan`, `classFull` — happens before the first write, so no student is left
behind without an enrollment. Untick the section (or have no plan or no class in the selected
period) and `createStudentAction` falls back to `create-student.ts`, which only attaches the
child to the family.

### Changing class

`src/use-cases/enrollments/reassign-class.ts` moves a `PENDING` or `ACTIVE` enrollment to another
class, in **one** `db.$transaction`: the (school, student, period) lock, then the enrollment row
(`FOR UPDATE`, status re-read → `invalidStatusTransition`), then the target class seat.

- **Same period only** → `periodMismatch`. An enrollment belongs to the period of its class (the
  open assignment, else the latest one); moving it to another period's class would open a second
  running enrollment there, billed twice in the family balance. The enrollment page offers only the
  classes of that period.
- **Another open enrollment of the student in the period** → `duplicateEnrollment`.
- **Target full** → `classFull`, counted under the class row lock.
- **Already in the target class** → `OK` without writing, so a double submit is harmless.
- The current assignment is closed (`endAt`) and the new one created in the same transaction: a
  failure leaves the student in the old class, never in none.

### Money

- `totalAmount = plan.amount - discount`, computed at creation and recomputed on every discount
  change against the **plan's current price** — not against the stored total.
- `remainingBalance = max(0, totalAmount - totalPaid)`. It never goes negative.
- Changing a plan's price does not retroactively change existing enrollments. Applying a discount
  does, because it recomputes from the plan.

## Plans

Owner: `src/use-cases/plans/`.

- **A plan an open enrollment uses cannot be archived** → `planInUse`. Open means `PENDING` or
  `ACTIVE`: those are still billed and still editable, so their plan must stay selectable. A
  `COMPLETED` or `CANCELLED` enrollment keeps its archived plan — nested reads return it.
- Archiving is a soft delete (`isActive: false`). Plan names are unique among active plans only, so
  an archived duplicate frees its name.

## Payments

Owner: `src/domain/payment.ts`, `src/use-cases/payments/`.

### One family balance

**A family pays, not a student.** Four children enrolled at 180 make one debt of 720, settled in as
many payments as the family wants. `calculateFamilyBalance()` in
`src/use-cases/payments/family-balance.ts` computes that single figure:

| Figure | Covers |
|---|---|
| `totalAmount` / `totalDiscount` / `remainingBalance` | `PENDING` + `ACTIVE` enrollments, across every period |
| `remainingAmountInCents` | the same remaining figure, as the integer Stripe charges |
| `totalPaid` | every active payment of the family, including those recorded on a `CANCELLED` or `COMPLETED` enrollment |

An enrollment awaiting validation is owed and payable: the money is collected when the family hands
it over, not when an admin gets to the enrollment. `CANCELLED` and `COMPLETED` enrollments no longer
owe anything and never receive an allocation. **Money received stays received**, though: their
active payments still count in `totalPaid` (the family's « Total payé »), so cancelling an
enrollment never makes a recorded payment disappear from the family totals.

### Recording a payment

`recordPayment()` never targets one enrollment. It takes a family-level amount and **distributes it
across that family's `PENDING` and `ACTIVE` enrollments**, proportionally to each remaining balance.

- **No enrollment left to pay** → `noPayableEnrollments`.
- **More than the family owes** → `overpayment`. The sum of remaining balances is the ceiling.
- **Every part is a whole euro.** Each proportional share is floored, then the euros left over go
  one by one to the first enrollments with room left: 100 € over three equal balances is
  34 + 33 + 33, never 33.33 or 33 + 33 + 34. No part exceeds its remaining balance, only the cents
  of a non-whole amount stay fractional, and the parts always sum to exactly the amount received.
- **Zero is rejected** by the schema; a negative amount is a refund.
- **Several payments are normal.** Each one is distributed against the balances left by the
  previous ones, until the family owes nothing.
- **Payments of one family are serialized.** Reading the balance, distributing and writing the
  `Payment` rows happen in one transaction that first locks the family row
  (`paymentGateway.lockFamilyForPayment`, a `SELECT … FOR NO KEY UPDATE` scoped by `id` and
  `schoolId`), through `readLockedFamilyBalances()` in
  `src/use-cases/payments/locked-family-balance.ts`. Two simultaneous 720 € payments on a 720 €
  balance record one: the second waits for the first to commit, rereads a zero balance and answers
  `overpayment`. The same helper serves `commit_record_payment`, where the second draft answers
  `overpayment` or `staleDraft`. A family missing from the school or archived → `notFound`. The
  Stripe webhook takes the same lock before rereading the balance it allocates, but records an
  archived family's capture anyway (see **Online payment**). Every other writer of a family's
  payments must take the same lock before reading the balance it distributes.

### Displaying a payment

The database keeps **one `Payment` row per enrollment**, so each enrollment knows what it received.
Screens show what the family handed over instead: `groupFamilyPayments()` in
`src/domain/payment.ts` folds the rows of one payment back into a single line with its split.

- **Rows belong to one payment** when family, method, reference, payment date, cash date and
  transaction all match, and they were written within five seconds of each other.
- **One enrollment appears at most once per payment**, so two identical cash payments recorded back
  to back stay two payments.
- Enrollment pages still show the part that enrollment received.
- **The period filter never cuts a payment in half.** The `/dashboard/payments` list groups every
  active payment first, then keeps a family payment as soon as one of its rows falls in the
  selected period — through `filterFamilyPaymentsByPeriod()` — and shows the full amount, with the
  part specific to that period underneath when it differs.

### Collection statistics

`src/domain/payment-stats.ts` feeds the payments dashboard. It reads the **same perimeter as the
family balance** — `PENDING` and `ACTIVE` enrollments, scoped to the selected period — so the
announced figures cannot drift from what a family is asked to pay.

| Figure | Rule |
|---|---|
| Due | Σ `totalAmount`, already net of discount |
| Collected | Σ active payments of those enrollments |
| Remaining | Σ `max(0, totalAmount - paid)`, floored per enrollment |
| Collection rate | `(due - remaining) / due`, capped at 100 % |
| Cheques to cash | `CHECK` payments without `cashedAt`; other methods are cashed on handover |

- **A trend chart ends on the last payment**, not on today: a closed school year would otherwise be
  displayed empty. It **never runs past the current month**: a payment dated in the future still
  counts in the totals but stays off the chart. Months without any payment stay in the series at zero.
- **Months are sliced in UTC**, like the payment dates entered in the form, whatever the server time
  zone.
- **Payments are aggregated in the database**; only the charted months are read row by row, so the
  cost does not grow with the school's payment history.
- **Follow-up lists a family, not an enrollment**, through `student.person.families`, the same link
  used by the family balance. An enrollment attached to no family is owed by nobody and ignored.
  A student attached to several families (shared custody) owes only one of them:
  `resolveDebtorFamily()` (`src/domain/family-debtor.ts`) picks the link with the highest-priority
  `relationType` — parent, then tutor, grandparent, sibling, other, in the order `RelationType` is
  declared — tied links breaking on the lowest `familyId`. `familiesOutstanding`,
  `findPayableByFamily` and the `/dashboard/families` list all resolve the same debtor, so a family
  never sees another family's debt on its own balance, and the follow-up total always reconciles
  with the sum of its rows.

### Refunds

A negative amount distributes proportionally to what was **actually paid** on each enrollment.
The same whole-euro split applies.
Refunding more than the family ever paid → `refundExceedsPaid`.

### Methods

`CASH`, `CARD`, `TRANSFER`, `CHECK` for manual entry; `STRIPE` exists in the enum but is written by
the checkout flow, not by the form.

- **`cashedAt` applies to cheques only.** Any other method carrying a cash date is rejected by the
  schema (`src/use-cases/payments/schemas.ts`), not merely hidden in the form.

### Online payment (Stripe)

`create-checkout-session.ts` / `complete-checkout-session.ts`.

- No usable credentials, or Stripe switched off by the school → `notConfigured`. The feature
  degrades, it does not crash. The session metadata carries `transactionId`, `familyId` and
  `schoolId`.
- Nothing owed → `noBalance`. The session is always opened for the **full `remainingBalance`**,
  pending enrollments included; partial online payment is not offered.
- The `PaymentTransaction` row is created **before** the Stripe session and its id is the
  idempotency key.
- A family never holds two payable Checkout sessions. Each session charges the full balance, so a
  second one (back button, a second parent) would charge twice. Before opening a session, every
  `PENDING` transaction of the family is closed: a session still `open` at Stripe is expired
  (`sessions.expire`) and its transaction marked `EXPIRED`; a session already `complete` means a
  payment is awaiting its webhook → `paymentInProgress`, and no new session opens. If Stripe
  cannot confirm the earlier session's state → `providerError`, never a second session. A session
  unknown to the current account (`resource_missing`: opened with other keys before the school
  changed its Stripe account) can never be paid on it, so its transaction is closed `EXPIRED`
  instead of locking the family; a late webhook from the former account still records it.
  Balance read, closing and opening run under a per-family advisory lock taken without waiting
  (`paymentGateway.tryLockFamilyCheckout`): a request arriving while another is opening a session
  for the same family → `checkoutInProgress`, so no database connection is held in a queue. That
  lock is distinct from `lockFamilyForPayment`: it is held across Stripe calls and must not block
  manual payments or the webhook.
- The webhook refuses only what predates the money leaving the customer's card: an already-seen
  provider event → `duplicate`; a transaction already `SUCCEEDED` → `duplicate`;
  `payment_status !== 'paid'` → `notPaid`; a different amount → `amountMismatch`; a different
  currency → `currencyMismatch`.
- **A payment captured by Stripe is always recorded.** The balance read at webhook time can be
  smaller than the captured amount (a manual payment entered during checkout, a session paid
  after another). `distributeReceivedPayment` (`src/domain/payment.ts`) allocates the captured
  amount against `FamilyBalance.payableEnrollments` (every payable-status enrollment, including
  already-settled ones) instead of `distributePayment`'s `overpayment`-refusing set. Each
  enrollment gets its normal share, capped at its remaining balance; anything beyond lands in full
  on the first enrollment as a visible family credit, for an admin to refund or keep.
- When no enrollment is payable anymore (all cancelled or completed during checkout), the whole
  amount is recorded on the family's latest enrollment whatever its status
  (`findLatestFamilyEnrollmentId`): money received stays received and counts in `totalPaid`. It is
  logged with `console.error` for an admin to reconcile.
- If the family has no enrollment at all, no `Payment` can exist, but the transaction is still
  closed `SUCCEEDED` with its provider event and `providerPaymentId` → `unallocated`, logged with
  `console.error`. The capture stays traced and Stripe stops retrying.
- Closing the transaction is conditional (`status` not yet `SUCCEEDED`) inside the same database
  transaction as the allocations: two distinct events for one session (`completed` then
  `async_payment_succeeded`, or a manual replay) record once, the second is a `duplicate`.
- The route (`app/api/stripe/webhook/route.ts`) answers 200 for `OK`, `duplicate`, `unallocated`
  and `notPaid` (an async payment is followed by `async_payment_succeeded`), so Stripe does not
  retry what no retry would change. `notFound`, `amountMismatch` and `currencyMismatch` still
  answer 422: they need investigation.

#### Stripe configuration per school

`src/use-cases/payments/stripe-settings.ts`, keys in `src/lib/stripe-config.ts`. Written from the
**Paiements** section of `/dashboard/config` (`stripe-settings-actions.ts`, `requireSchoolAdmin()`,
`schoolId` from the session, layout revalidated on success).

- Three school `Config` rows: `stripe_enabled` (BOOLEAN), `stripe_secret_key` and
  `stripe_webhook_secret` (TEXT, encrypted with `src/lib/secret-crypto.ts` like the OpenRouter key).
  A secret is never sent back: the page receives only `configured`, `notConfigured` or `unreadable`
  (encrypted under another `SETTINGS_ENCRYPTION_KEY`). Without that key, saving answers
  `secretStorageNotConfigured` rather than storing in clear.
- The secret names are **not** in `SCHOOL_CONFIG_KEYS`, so the generic editor and `setConfigAction`
  can neither show nor write them, and `getConfig` answers `notFound` for them.
- Input format is checked before encryption: `sk_`/`rk_` + `test`/`live` for the key (a pasted
  publishable `pk_` key is refused), `whsec_` for the webhook secret → `validationError`.
- **Resolution: the school's pair, else the instance pair** (`STRIPE_SECRET_KEY` +
  `STRIPE_WEBHOOK_SECRET`), **never a mix**. A school key with the instance webhook secret would
  sign for one account and verify for another. An unreadable school secret counts as absent.
- **Absence of `stripe_enabled` reads as enabled** (`readsAsEnabled`), so a school already paid
  through the instance keys keeps its button. It is effective only when configured: `available` =
  enabled **and** a readable pair exists. The toggle is disabled with an explicit message while no
  pair is readable, and enabling without one → `notConfigured`. Disabling is always allowed.
- The parent « Payer en ligne » button (dashboard and family page) reads `isOnlinePaymentAvailable`;
  `createCheckoutSession` reads `resolveCheckoutCredentials`, which returns `null` when the school
  switched Stripe off → `notConfigured`. `payments_enabled` is checked first and still wins.
- **Webhook per school**: `/api/stripe/webhook/{schoolId}` (URL shown and copyable in the config
  page). The school comes from the path, validated as a UUID, and its secret verifies the
  signature; the body is never trusted to pick the school. It resolves credentials **without**
  reading `stripe_enabled`: a payment captured before the cut is still recorded. The verified
  `schoolId` is passed to `completeCheckoutSession`, which answers `notFound` for a transaction of
  another school. The legacy `/api/stripe/webhook` keeps verifying with the instance pair only.

### Activating payments per school

`payments_enabled` (`src/lib/payment-config.ts`) is a **school** `Config` row, not a
`PlatformSetting`: a structure that only registers pupils and collects money elsewhere decides for
itself, and the school next door is unaffected. It reads through `isPaymentsEnabled(schoolId)`
(`src/use-cases/config/is-payments-enabled.ts`), memoised per render like the platform flags, and
scoped by `schoolId`, so the tenant guard covers it.

**Absence of the row reads as enabled** (`readsAsEnabled`, `src/domain/feature-flags.ts`, shared
with the platform flags), and so does an unexpected value. This is the opposite reading of
`teacher_expenses_enabled`, which is an opt-in because it opens a function nobody had; this one
closes a function every school in service already owns. No migration is therefore needed, and none
writes `'false'` anywhere: a new school is created with the row at `'true'`
(`SCHOOL_CONFIG_DEFAULTS`), an older school has no row and keeps its payments.

With payments off, no surface names a plan: the dashboard's recent enrollments and the class roster
drop their plan column, the family page's child card shows neither the plan, nor the paid/due
amounts, nor the progress bar (`child-card.tsx`), and its activity feed drops payments and plan names
(`activity-feed.tsx`); only enrollment status and class remain. With payments
on, the reserved `__unpriced__` plan renders as the « À tarifer » badge, never under its stored name.

The write surface is the first row of the **Paiements** section of `/dashboard/config`
(`stripe-settings-section.tsx`), open to a school `ADMIN`; the **School settings** panel skips the
key. It still writes through `setConfigAction` over the closed key list (`SCHOOL_CONFIG_KEYS`), so no
dedicated action exists: a second screen for one value, accepting any string, is the mistake
`school_name` already taught. The Stripe rows below it collapse while payments are off, mirroring
the server, where `payments_enabled` wins over `stripe_enabled`.

**Two flags confirm before cutting**, because they make already-recorded state invisible:
`payments_enabled` counts payments and `PENDING` transactions (`paymentGateway.countFootprint`),
and `teacher_expenses_enabled` counts recorded notes (`teacherGateway.countExpenses`). Nothing is
deleted, and everything reappears on re-enabling. `FlagToggle` takes that confirmation as an
optional prop, so a row without a footprint keeps the one-click behaviour.

`setConfigAction` revalidates the whole layout, not just its page: branding, theme and the
navigation flags (`payments_enabled`, `events_enabled`) change the shape of the sidebar and the
dashboard, so leaving them cached would show a state the administrator just contradicted.

`teacher_expenses_enabled` also lost its two divergent raw reads — a `db.config.findFirst` outside
the gateway, hence outside the tenant guard, and a hand-rolled `!== 'true'`. Both now read through
`isTeacherExpensesEnabled(schoolId)`, the single opt-in reading shared by `/dashboard/teachers` and
`createTeacherExpense`.

Every callable boundary answers `paymentsDisabled` before reading or writing anything:
`recordPayment`, `createCheckoutSession`, `applyDiscount`, `setEnrollmentPlan`, `createPlan`,
`updatePlan`, `deactivatePlan`, and the four money tools of the MCP. The verdict belongs to the
use-case; pages and components only mirror it. `/dashboard/payments` and `/dashboard/plans` answer
`notFound()`, and the sidebar drops both entries through the `feature` mechanism of
`resolveNavItems`: `payments` and `plans` declare `feature: 'payments'`, read from
`NavScope.features` beside `events`. A flag that closes a navigation surface belongs there rather
than in a bespoke filter.

**The Stripe webhook never reads the flag.** A transaction can only exist if the session was opened
while payments were on; by the time the webhook lands the money is captured at the provider, so
refusing would strand a real payment with no row. Idempotence already frames the rest.

Machine access closes by **omission**: `McpScope` carries `paymentsEnabled`
(`resolve-mcp-scope.ts`, the single read for a request, which keeps `buildMcpServer` synchronous),
and `list_plans`, `preview_record_payment`, `commit_record_payment`, `preview_update_enrollment`
and `commit_update_enrollment` are not declared at all. A tool that is absent does not mislead the
agent into promising a collection it cannot make. Those four money use-cases still refuse on their
own, and `commitEnrollFamily` — declared whatever the flag, since enrolling stays open — refuses the
money part of its draft, which is what stops a draft prepared before the cut from being committed
after it.

#### Enrolling without money

`Enrollment.planId` is `NOT NULL` behind a composite foreign key, and `plan.name` is read by the
list, the detail, the drawer, the promotion and four MCP use-cases. Rather than propagate a null
case through all of them, a school that enrolls while payments are off gets a **reserved plan**:
one `Plan` row named `__unpriced__` at `amount: 0`, created **on demand** by
`planGateway.ensureUnpriced()` at the first such enrollment — a school that never disables payments
never carries the row. `totalAmount` and `discount` are written at zero, an explicit `planId` or a
non-zero discount is refused, and `createEnrollmentSchema.planId` is optional for that reason.

**Three write paths, one rule.** `createEnrollment`, `createEnrolledStudent` (the *Add a student*
dialog of the family page, which enrolls in the same gesture) and the MCP `enroll_family` commit all
refuse an explicit `planId` or a non-zero discount while payments are off, and all resolve the
reserved plan **inside** their transaction so a full class rolls it back. `commitEnrollFamily`
refuses only the **money part** of a stored draft (`paymentsDisabled`, lock released): enrolling
stays open, which is the point of the flag, but an amount or a payment decided before the cut has no
screen left to show it.

The reserved row is excluded from every catalogue and selector read, cannot be archived
(`unpricedPlan`), cannot be created by hand under that name — and `updatePlan` refuses it **in both
directions**: renaming an ordinary plan into it would hide that plan from every catalogue with no
way back, and let `ensureUnpriced` adopt its amount, so an enrollment meant to be unpriced would be
born priced; renaming the reserved row out would have a second one created at the next cut.
**The stored name never reaches a screen**: the displayed label comes from `messages/*.json`.

Re-enabling exposes those enrollments as *needing a plan*, and `setEnrollmentPlan`
(`src/use-cases/enrollments/set-enrollment-plan.ts`) prices them against the plan's **current**
amount minus the discount they already carry, refusing `totalBelowPaid` on the same rule as the
MCP `update_enrollment` path. Without it the flag would create a state the UI could not repair.

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
- **Idempotent.** The eligibility pass reads outside any lock and only pre-filters. Each student's
  transaction takes the (school, student, **target** period) lock of `createEnrollment`, re-reads
  whether the student already holds an enrollment there (`enrollmentGateway.isEnrolledInPeriod`,
  `PENDING`/`ACTIVE`/`COMPLETED` → `alreadyPromoted`) and reserves the target seat under the class
  row lock (`targetClassFull`, or `noTargetClass` if archived meanwhile). A double click or two admins
  running it together create one enrollment per student and never overfill a class; a refusal is
  counted as skipped and writes nothing.
- **The source level is the open assignment's.** `findCompletedByPeriod` includes only the
  assignment with `endAt: null` in the source period: after a mid-year class change, the closed one
  would name the wrong starting level.
- **Archived students are not promoted.** The soft-delete filter does not reach nested relations,
  so `findCompletedByPeriod` states `student: { isActive: true }` itself.

## Families, students, people

- **Family name**: required, at most 50 characters (`src/domain/family.ts`).
- **Names and free-text family fields are trimmed by the schema**: person first and last names, and
  the family name, emergency contact name, authorized pickup, address, post code and city. A name
  made only of spaces therefore returns `validationError`.
- **Phone numbers** match `/^\+?[\d\s().-]{6,20}$/`, on parents, emergency contacts and additional
  numbers alike.
- **Update semantics**: on `updateFamilySchema`, optional fields are `nullish` — `undefined` leaves
  the column untouched, `null` clears it. A field emptied in a form must send `null`, not be omitted.
- **Updating a family member** (`src/use-cases/families/update-family-person.ts`) requires the person
  to already be linked to the family → `notFound` otherwise. Person fields, relation type and the
  primary phone number are written in one transaction; `phoneNumber: null` deactivates that number
  instead of deleting it, and the first active number is the one edited.
- **A person's sex and a student's birthday are optional** — `Person.sex` and `Student.birthday`
  are nullable. A paper enrollment sheet often carries neither, and a required field forced the
  operator to invent a value that then read as real data. A form left blank sends `undefined` on
  create and `null` on update, which clears the column; age is simply not shown.
- **A student's age is computed by `calculateAge` alone** (`src/lib/date.ts`): completed years,
  a birthday counting only once passed, the stored day read in UTC. The reference date is always
  explicit; the students table receives it from the server so its client render cannot disagree
  with the server's around a birthday.
- **A family may be created without any parent**, on the dashboard and through `enroll_family` alike.
- **Languages spoken at home belong to the family, not the student**, and are always optional.
  `Family.languagesAtHome` is a JSON list of free-text names, at most 20 entries of 50 characters
  (`src/use-cases/families/schemas.ts`). The form takes a comma-separated list; blanks and duplicates
  are dropped (`parseLanguagesAtHome`, `src/domain/family.ts`) and an emptied field clears the list.
  A student's page shows the languages of its family. `enroll_family` does not set them.
- **A student's birthday, when given, must be in the past** → `validationError`
  (`src/domain/student.ts`).
- **A student carrying a `PENDING` or `ACTIVE` enrollment cannot be archived**
  → `hasActiveEnrollments`.
- **A family cannot be archived either while any of its students holds one** — same discriminant,
  counted across every person linked to the family.

### Deleting a family for good

Archiving hides a family; `src/use-cases/families/delete-family.ts` erases it. The action is open to
a school `ADMIN` and to a super admin (`requireSchoolAdmin`), and is the only place in the product
where financial history is destroyed rather than archived.

- **The family name must be retyped**, compared trimmed and case-insensitively → `confirmationMismatch`.
  Same barrier as `deleteUser`, which asks for the account's email.
- **No archive prerequisite**, unlike a user deletion: an archived family is invisible to `db`, so
  requiring one first would make the record unreachable. `findByIdIncludingArchived` reads through
  `dbArchived` so both states can be deleted.
- **`familyGateway.deleteWithRelated` runs the whole graph in one transaction.** Nothing is cascaded
  by the database along that path: `Payment.family` and `PaymentTransaction.family` are `Restrict`,
  and so are the next links — `Enrollment.student`, `AttendanceEntry.student`,
  `ClassAssignment.enrollment`, `Invitation.person`, `Payment.enrollment`,
  `Payment.paymentTransaction`. Each table is therefore emptied explicitly, leaf first. What is
  `Cascade` — `UserFamily`, `FamilyPerson`, `PhoneNumber`, `Invitation.family` — goes with its
  parent, and `PaymentProviderEvent` is `SET NULL`, so the Stripe journal survives, detached.
- **Every non-cascading foreign key into the deleted graph is listed** in
  `FAMILY_DELETION_CLEARED_RELATIONS` (`src/gateways/family-gateway.ts`).
  `src/gateways/__tests__/family-deletion-restrict-guard.test.ts` reads `prisma/schema.prisma` and
  fails when a relation that is `Restrict` (explicit, or implicit on a required relation) points at a
  deleted or cascaded model without being on that list. A new table attached to a student, person,
  family or enrollment must be emptied by the transaction, or its presence decided here, before
  that test passes.
- **A deleted student's attendance goes with it**, validated sessions included. The attendance rules
  require no retention: an entry only records one child's presence at one call, and without the
  student it designates no one. Keeping it would mean keeping the student, which is exactly what
  the deletion erases — along with payments, a far heavier history. The `AttendanceSession` itself
  stays, with its other entries and its validation; only the deleted child's row leaves the roster.
  A student shared with another family keeps their attendance, like the rest of their record.
- **A foreign key that still refuses the deletion returns `deletionBlocked`**, never an error
  boundary. The transaction rolls back whole, so nothing is erased, and the dialog says so and
  suggests archiving instead. Reaching it means a relation escaped the guard above.
- **The deletion locks the `Family` row first** (`SELECT … FOR UPDATE`, archived rows included),
  in the order a payment takes: `paymentGateway.lockFamilyForPayment`, then the `Payment` insert
  that key-shares the enrollment. A payment and a deletion on the same family therefore queue
  instead of deadlocking. A family gone by the time the lock is taken returns `notFound`. A
  residual serialization failure or deadlock (`P2034`) returns `deletionConflict`: nothing was
  erased and the admin can retry. Any other error is rethrown.
- **A person linked to another family survives**, along with their student and enrollments: only the
  link to the deleted family goes. Their invitations survive too — only a person actually deleted
  has theirs removed, because `Invitation.person` is `Restrict`.
- **The transaction reads through `dbArchived`.** An archived payment, person, student or enrollment
  is invisible to `db` but its foreign key blocks the deletion just the same.
- **The confirmation dialog counts what the deletion will take, not what the page shows.**
  `familyGateway.countDeletionImpact` and `deleteWithRelated` share one `resolveDeletionScope`
  traversal, so the preview includes archived rows and excludes the shared persons that survive.
  It lists members, students, enrollments, attendance records and payments.
  Deriving it from the page's own read would have announced zero students while erasing an
  archived one.

## Configuration

`src/use-cases/config/set-config.ts`. Values are stored as strings with a declared type, **scoped to
one school**.

- **Only enumerated keys are writable.** `SchoolConfigKey` (`src/lib/school-config.ts`) lists them;
  any other name → `validationError`, and `/dashboard/config` offers no free-form creation. A free
  name was read by no code and only suggested it governed something. Rows left under an unknown
  name stay in the database but are neither displayed nor writable.
- **The type is fixed by the key** (`SCHOOL_CONFIG_VALUE_TYPES`), never chosen by the caller.
- `NUMBER` must parse as a number, `BOOLEAN` must be exactly `'true'` or `'false'`, `COLOR` must be a
  hex color (it is injected into the layout `<style>`), otherwise → `invalidConfigValue`. `TEXT`
  accepts anything.
- The screen shows one row per key, in declaration order: a toggle for a `BOOLEAN`, an edit dialog
  otherwise. A key without a row shows its `SCHOOL_CONFIG_DEFAULTS` value, else *not configured*.
- **The four theme colors share one palette editor** (`THEME_COLOR_KEYS`, `src/lib/theme-palettes.ts`)
  instead of four rows. Each swatch opens a picker; ten ready-made palettes fill all four at once.
  Nothing is written before *Save*, which calls `setThemeColorsAction` → `setThemeColors` with **only
  the changed colors**, so a derived token never set keeps following the primary color. The colors
  are validated together and written in one transaction (`configGateway.setMany`): one invalid hex
  writes nothing. Every preset keeps white text at AA (4.5:1) on primary and hover, and 3:1 between
  primary and its light and background colors, and hover text at AA on light; `theme-palettes.test.ts`
  enforces it.
  The presets list is collapsed by default and names the palette the draft matches.
- **Each theme color has a visible use.** Primary: default buttons, links, active nav item. Hover:
  button hover, the active nav gradient, hovered text of outline/ghost buttons and nav items. Light:
  outline/ghost button and nav item hover backgrounds, light badges; with primary, the 404 error page
  accent. Background: every page behind the white cards — `body`, the dashboard layout, the error
  page gradients (`bg-background`) — `#f7f7f7` until set, the look before it was themable.
- `@@unique([schoolId, name])` is a **partial** index, restricted to `isActive: true`. An archived
  entry therefore never reserves its name, and `configGateway.get` is deterministic.
- **A partial unique cannot be used as a write selector.** Prisma emits the `schoolId_name` selector
  without the index predicate, so an archived homonym makes two rows match and the query fails with
  *Expected zero or one element, got 2* — verified against PostgreSQL 18. `configGateway.set`
  resolves the active row with `findFirst`, then updates it by **primary key**, keeping `schoolId` in
  the filter for the tenant guard. The other partial uniques (`Level`, `Period`, `Plan`) are never
  written through: those gateways address rows by `id_schoolId`, which is a total unique.
- Consumed today: `max_students_per_class` (default class capacity),
  `teacher_expenses_enabled` (enables generic teacher expense notes,
  `src/lib/teacher-expense-config.ts`), `events_enabled` (enables the Events feature, off by
  default, `src/lib/events-config.ts`), `payments_enabled` (governs every money surface of the
  school, `src/lib/payment-config.ts`, detailed under *Activating payments per school*),
  `logo_url` (`src/lib/branding-config.ts`), and `theme_primary`, `theme_primary_hover`,
  `theme_primary_light`, `theme_background` (`src/components/theme-provider.tsx`).
- **The school name is no longer a `Config` entry.** It lives on `School.name`, the single source of
  truth; keeping the old `school_name` key would have let two screens edit two different names. The
  migration copies it over and deletes the key.

## Branding images

`src/use-cases/media/upload-branding-image.ts`, `src/gateways/storage-gateway.ts`.

`logo_url` accepts either a URL typed by hand or a file uploaded to the object store. It ends up as a
plain string in `Config`, so an external URL keeps working.

- **There is one image setting, not two.** `app/icon.tsx` generates the favicon from the logo, fitted
  into its square without distortion, and `app/manifest.ts` lists the logo as the app icon. Without a
  logo the favicon is the platform default.
- **The favicon inlines the logo** (`src/lib/branding-icon.ts`). `next/og` refuses a relative source,
  and an uploaded logo is a relative `/api/media/…` path: it is resolved against
  `NEXT_PUBLIC_APP_URL`, never against the client-supplied `Host` header, which would make the server
  fetch a host of the caller's choosing. A missing logo, a failed fetch, or a format the renderer
  cannot draw (ICO) falls back to the default favicon instead of failing the request. **A WebP logo is
  converted to PNG first**: `next/og` crashes on WebP, the format of every uploaded logo, rather than
  skipping it. A `favicon_url` row left by an older installation stays in the database but is read by
  nothing: a second setting would let the tab icon drift from the logo.
- **The logo is shown in the sidebar and in the header of `/login`.**

- Uploading requires an admin.
- **Accepted types**: PNG, JPEG, WebP, SVG. Anything else → `unsupportedType`. ICO is no longer
  accepted: sharp cannot decode it, and the favicon is generated from the logo anyway.
- **10 MB maximum for the received file**, and an empty file is refused → `fileTooLarge` /
  `emptyFile`.
- **Every uploaded image is stored as WebP** (`src/lib/image-optimizer.ts`), whatever format was
  sent: the logo is shrunk to 512 px on its longest side (never enlarged), quality 90. An SVG is
  rasterized, which also strips any active markup. The EXIF orientation is applied, then all
  metadata is dropped. A file sharp cannot decode → `invalidImage`, and nothing is stored. A URL
  typed by hand is kept as is. Logos uploaded before this rule keep their original format.
- **The size is checked in the form before sending**, against the same `MAX_BRANDING_IMAGE_BYTES`
  (`src/lib/branding-config.ts`). Past the Server Actions body limit Next.js throws before the action
  can answer, so a server-only check surfaced as a runtime error instead of `fileTooLarge`.
  `next.config.ts` raises that limit to 11 MB: a 10 MB file plus its multipart envelope. It raises
  `experimental.proxyClientMaxBodySize` to 11 MB too: past its 10 MB default, the body handed on
  after `proxy.ts` is silently truncated.
- The object is stored under `branding/<schoolId>/<uuid>.webp`; the caller never chooses the key,
  so an upload cannot overwrite another one, and one school cannot reach another's assets.
- Configuration is `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, optionally
  `S3_REGION` and `S3_FORCE_PATH_STYLE`. Path style is the default, which is what MinIO expects.
  Without those variables the feature answers `notConfigured` rather than crashing — the rest of the
  configuration screen keeps working, and a URL can still be typed by hand.
- **Every environment points at the same MinIO**, local development included; there is no container
  for it in `compose.yaml`. A logo uploaded while developing lands in the shared bucket. Keys are
  UUID-based, so nothing is ever overwritten, but stray objects do accumulate under `branding/`.
- **Objects are served through the application**, at `GET /api/media/branding/…`, not from a public
  bucket. The route accepts only a `branding/<school>/<object>` shape and refuses any key containing
  `..`, so the bucket needs no public policy and no CORS.

### Which school's branding is rendered

`resolveBrandingSchoolId()` (`src/lib/branding.ts`) is the single answer, and **the session context
wins over the cookie**. The two disagree whenever the cookie is stale, names a deactivated school, or
its membership was revoked: `getSchoolContext()` then falls back to the first membership, so a
cookie-only resolution would paint school A's dashboard with the default theme. The theme follows the
school actually on screen.

The cookie remains the fallback, for surfaces that may be requested without a session — `app/icon.tsx`,
`app/manifest.ts` and `/login`. With neither signal, the platform default applies.

**The login page is dressed as the last school displayed.** The dashboard layout compares the cookie
with the school on screen and, when they differ, mounts `RememberActiveSchool`, which calls
`rememberActiveSchoolAction` — a Server Component cannot write a cookie. The action takes no input:
it writes the school of the already validated `getSchoolContext()`, so it can neither open a school
the caller does not hold nor bypass the switch flag. After logout, `/login` shows that school's logo
and theme. A first visit on a device has no cookie and gets the platform identity. An impersonation
rewrites the cookie to the impersonated account's school, which the login page then shows. The theme itself is read in
`app/[locale]/layout.tsx`, **above** the dashboard, which is why a cookie is needed at all: a column
on `Session` would be unreadable there.

### The `company` namespace is the operator, not a tenant

`company` in `messages/*.json` describes the entity that **runs the platform** — legal name, SIRET,
registered address, host. It is not a school, and a displayed school identity is never sourced from
it. The rule matters because a single-school deployment made the two look interchangeable: the
sidebar fell back to `company.name` when the branding read returned nothing, which under several
schools would have labelled school B with a name belonging to no tenant at all.

Displayed identity therefore comes from `School.name` alone. Where none is resolved, the fallback is
the neutral platform title `metadata.platformTitle`, not an operator name: the document title in
`app/[locale]/layout.tsx`, and the sidebar head in `src/features/dashboard/sidebar.tsx`. Strings that
address the reader inside a school — greeting, welcome card, unlinked-parent notice, invitation
email — interpolate `{schoolName}` instead of naming one school in the source text.

## Events

Owner: `src/domain/event.ts`, `src/domain/event-ics.ts`, `src/use-cases/events/`,
`src/gateways/event-gateway.ts`.

- **Gated by the school setting `events_enabled`** (`src/lib/events-config.ts`), off by default.
  Five enforcement points read the same flag, independently: the sidebar entry
  (`src/features/dashboard/sidebar-items.ts`), the dashboard page (`notFound()` when it is off),
  every use-case in `src/use-cases/events/` — after `safeParse` rejects malformed input
  (`'validationError'`), before anything else — `listPublicEvents` (public page and ICS feed, both
  answer `notFound`/404), and `isEventsEnabled` (`src/use-cases/events/is-events-enabled.ts`, the
  dashboard J-x banner and the "Prochains événements" card). `isEventsEnabled` is the one reader with
  fail-closed semantics spelled out explicitly in code: unlike `isPaymentsEnabled`
  (`readsAsEnabled` — absence of a row reads as enabled), an events flag that has never been written
  reads as **disabled**, matching `EVENTS_CONFIG_DEFAULT.value = 'false'` and every use-case's own
  `config?.value !== 'true'` check. The public event page
  (`app/[locale]/ecole/[slug]/evenements/[eventSlug]/page.tsx`) reads it too and answers `notFound()`
  like the dashboard.
- **Visibility is an ordered scale, not a set of independent tags**: `PUBLIC ⊂ MEMBERS ⊂ STAFF`
  (`EventVisibility`, `prisma/schema.prisma`). `visibleEventVisibilities()` (`src/domain/event.ts`)
  turns a viewer into the list of visibilities it may read, which replaces a viewer × category
  matrix. There is no `TEACHER` audience yet: teacher capability is restricted to **My classes**, so a
  teacher-only event visibility would be unreachable by its intended audience.
- **`EventCategory` is purely presentational** — icon, color, filter — and never restricts who can
  see an event. Confidentiality lives exclusively in `EventVisibility`; keeping the two axes separate
  avoids an admin believing that picking a category narrows the audience.
- **`CANCELLED` is not an archival state.** A cancelled event stays visible, shown struck through —
  families have already organized their day around it. Archiving instead sets `Event.isActive` to
  `false`, and only that hides the event.
- **The slug is unique per school, scoped to active events** — `@@unique([schoolId, slug], where: {
  isActive: true })`. A collision is refused outright (`'slugTaken'`), never resolved by appending a
  suffix: a silently renamed slug would break a link already shared with families.
- **`allDay` fixes a storage and display convention.** An all-day event stores `startAt`/`endAt` at
  UTC midnight (`normalizeEventDates`, `src/domain/event.ts`), and `formatEventDate`
  (`src/lib/date.ts`) forces `timeZone: 'UTC'` when rendering it. Without both, a whole day would
  render as the previous day for any reader west of Greenwich. Both formatters go through
  `Intl.DateTimeFormat#formatRange`, so each locale joins a range its own way (« 10–12 mars 2026 »,
  « jeudi 3 décembre 2026 à 18:00 ») instead of a hand-built `start – end` string.
- **The dashboard list follows the period selected in the header** (`getSelectedPeriod`), like
  classes and payments; there is no year filter. An event is listed when it overlaps the period:
  it starts before the day after `Period.endAt` (an inclusive day, `eventPeriodBounds`) and ends —
  or, without an end, starts — on or after `Period.startAt`. A school without any period sees all
  its events.
- **`EventImage.position === 0` is the cover image.** There is no `coverImageId` column on `Event`:
  that would let a cover point at another event's image. `EventImage` carries no `isActive` either,
  deliberately — the soft-delete extension (`src/lib/db.ts`) only filters the root of a query, so an
  archived image would still surface through `event.images` via `include`. Removal is real, and
  `removeEventImage` renumbers the remaining `position`s to `0..n-1` inside one transaction so the
  cover invariant never gaps. `setEventCover` makes another image the cover: `reorderImagesForCover`
  (`src/domain/event.ts`) moves it first and keeps the others in their relative order, and
  `eventGateway.reorderImages` rewrites the positions in one transaction, so no reader ever sees two
  covers.
- **Six images per event, enforced server-side** (`MAX_EVENT_IMAGES`, `src/domain/event.ts`):
  `addEventImage` refuses a seventh with `'tooManyImages'`. Images are managed in their own dialog,
  not in the edit form: an image is saved the moment it is uploaded, while the form waits for
  « Enregistrer », and mixing both let an admin believe cancelling the form undid an upload. The
  dialog accepts several files but sends them **one after the other** — parallel uploads would each
  read the count before the others land and could cross the limit together — and stops at the first
  refusal.
- **Upload accepts PNG, JPEG and WebP only — no SVG**, unlike branding images: an event image is
  content shown to families, not an operator-controlled asset, so active SVG markup is refused
  outright (`'unsupportedType'`). The received file may weigh up to 10 MB (`'fileTooLarge'`) and an
  empty file is refused (`'emptyFile'`) (`MAX_EVENT_IMAGE_BYTES`, `src/domain/event.ts`).
- **Every event image is stored as WebP**, like the logo (`src/lib/image-optimizer.ts`): shrunk to
  2000 px on its longest side (never enlarged), quality 80, EXIF orientation applied then metadata
  dropped — a phone photo keeps its orientation but not its location. An undecodable file →
  `'invalidImage'`, nothing stored. Images uploaded before this rule keep their original format.
- **The dialog never sends a file over 10 MB**: it skips it with a « dépasse 10 Mo » toast and sends
  the others. Next.js enforces `experimental.serverActions.bodySizeLimit` and
  `experimental.proxyClientMaxBodySize` (both 11 MB, `next.config.ts`)
  on a server action's entire body, attachment included, before the action runs; an oversized
  request surfaced as an opaque 500 instead of the typed refusal. An action that throws anyway ends
  the batch with an « envoi a échoué » toast. The object is stored under
  `events/<schoolId>/<uuid>.webp` and
  served through `GET /api/media/events/…`, the same public-but-unenumerable route as `branding/`.
  Without the object-store configuration, the upload use-case answers `'notConfigured'` rather than
  crashing, exactly like branding — but `uploadEventImageAction` **renames it
  `'storageNotConfigured'`** (`app/[locale]/(dashboard)/_lib/event-actions.ts`). The two conditions
  share no message: the use-case discriminant means "the feature is off", the storage one means
  "there is no S3", and collapsing them told an administrator whose setting was on that events were
  not enabled.
- **Yearly duplication replaces a recurrence rule** (`duplicateEvent`,
  `src/use-cases/events/duplicate-event.ts`). A school calendar is carried over by hand each year
  (weekday, holidays), so an RRULE would produce dates to fix one by one. `shiftEventToNextYear`
  (`src/domain/event.ts`) moves the start to the same UTC day next year — a 29 February lands on the
  28th — and keeps the start-to-end duration. The copy is created through `createEvent`, so it passes
  the same flag, range and slug checks: it is always `DRAFT`, keeps category, visibility, texts,
  location and announcement delay, and never copies images (last year's poster carries its date).
  The title is an input of the duplicate dialog, prefilled with the source title: an unchanged title
  hits `'slugTaken'`, which the admin fixes in the form, never through a suffix. The source is never
  written.
- **The printable poster lives outside the dashboard layout**
  (`app/[locale]/(print)/dashboard/events/[id]/affiche/page.tsx`), so no sidebar or header reaches
  the print. It requires a school admin and `events_enabled` (`notFound()` otherwise, like the list),
  and renders a fixed 210 × 297 mm sheet with `@page { size: A4; margin: 0 }`; the sheet clips its
  own overflow, so a long description can never spill onto a second page. The school logo appears
  there as a faint watermark — on a poster it signs the document, in a list it would hinder reading.
  No PDF is generated server-side: the browser's print dialog produces the same page.
- **Row actions live in one « ⋯ » menu** (`event-actions-menu.tsx`), built like `LevelActionsMenu`:
  the panel is hidden in CSS rather than unmounted, so closing the menu never closes a dialog opened
  from it, and each dialog restores focus to the « ⋯ » button.
- **The public page of an event is `/[locale]/ecole/<schoolSlug>/evenements/<eventSlug>`**
  (`app/[locale]/ecole/[slug]/evenements/[eventSlug]/page.tsx`), reachable without a session —
  `proxy.ts` only protects `/dashboard`, `/settings` and `/profile`. `resolveEventPageAccess`
  (`src/domain/event.ts`) decides who reads it:
  - `public` — `PUBLIC` visibility and not `DRAFT`. A `CANCELLED` event stays readable, struck
    through, for the same reason it stays in lists: a link already shared must announce the
    cancellation, not answer a 404.
  - `preview` — anything else, for a signed-in admin **of that school** (`getAuthorizedSchools()`,
    per-school `isAdmin`; a super admin covers every school). The page carries a banner naming the
    status and visibility, and `robots: noindex` with no Open Graph data.
  - `hidden` — anything else, for everyone else: `notFound()`, exactly like an inactive school, a
    disabled `events_enabled`, an archived event or an unknown slug. The page never says why.
  The session is only read when the event is not public, so an anonymous visitor costs no role
  resolution. A public page exposes `generateMetadata` Open Graph data (title, summary, cover). It is
  themed with **the event's school**, not the visitor's: the root layout themes from the session or
  the `active_school` cookie, often absent here, so the page renders its own `ThemeProvider` after it.
  The « Copier le lien public » menu entry copies the absolute URL whatever the status, but warns
  when the page is not public yet, since the link would 404 for its recipients.
- **`create_event` on the MCP server is an adapter of `createEvent`**
  (`src/use-cases/mcp/create-event.ts`), not a second implementation. The tool is declared whether or
  not `events_enabled` is on, and a disabled school gets the server action's own `'notConfigured'`.
  It accepts no `status` — a dictated event is born `DRAFT` and published from the dashboard — and
  its dates are a day or a zone-less wall-clock time: an offset would be an instant, not the hour
  read on a flyer.
- **The MCP rereads and corrects events, it never publishes them.** `list_events` and `get_event`
  read through `src/gateways/mcp-read-gateway.ts` with explicit `select`s and no image, since the
  media route does not check status or visibility. `update_event` runs `updateEvent` with
  `draftOnly`: a non-`DRAFT` event is refused with `'notDraft'`, and `eventGateway.update` adds
  `status: 'DRAFT'` to its `where`, so a publication between the read and the write fails the update
  instead of editing a live event. `duplicate_event` is `duplicateEvent` unchanged. None of them
  accepts a `status`.
- **Both `Event` and `EventImage` are tenant-scoped** (`src/lib/tenant-guard.ts`); `Event` is also
  soft-deleted through the shared extension (`src/lib/db.ts`), so an archived event disappears from
  every top-level read without a filter written by hand.
- **The media route does not consult `EventVisibility` or `EventStatus`.** Confidentiality of an
  event's bytes rests entirely on the object key being unguessable (two independent UUIDv4s), not on
  the visibility chosen for the event — a `DRAFT` or `STAFF`-only image is served to an
  unauthenticated request that already holds its key, with a one-year immutable cache header. This
  stayed survivable once the public event listing shipped (#326) because that surface is what
  filters which events it links images for, rather than the route gaining a visibility check: only a
  `PUBLIC`/`PUBLISHED`-or-`CANCELLED` event's cover ever reaches a public page or the Open Graph
  image, enforced twice — the projection query, and `filterVisibleEvents` (`src/domain/event.ts`)
  replaying the same visibility/status bound as a defense-in-depth filter on the result, so a future
  bug in the query alone cannot leak a `MEMBERS`/`STAFF`/`DRAFT` event's image key.
- **Public listing and ICS feed share one projection**, `listPublicEvents`
  (`src/use-cases/events/list-public-events.ts`, memoised with `React.cache()` so
  `generateMetadata` and the page body cost one query): visibility `PUBLIC`, status `PUBLISHED` or
  `CANCELLED` — never `DRAFT` — of an active school whose slug resolves and whose `events_enabled`
  is on; anything else is `'notFound'`/`'notConfigured'`, both rendered as a plain 404 by the public
  page (`app/[locale]/ecole/[slug]/evenements/page.tsx`) and the ICS route
  (`app/api/schools/[slug]/events.ics/route.ts`) alike — the doctrine of hiding a disabled feature
  rather than announcing its unavailability extends to these two public, unauthenticated surfaces.
  `CANCELLED` is included, struck through like the admin table: the same "stays visible" doctrine
  applies to a public visitor who bookmarked the page, and to a calendar already subscribed to the
  feed. **In mono-school deployments**, `/[locale]/evenements` looks up every active school
  (`schoolGateway.listActive()`) and issues a 308 to the single result's canonical
  `/ecole/<slug>/evenements` — the same bypass doctrine as the sidebar's school switcher, transposed
  to a public route that carries no session to read a membership list from. Zero or several active
  schools answer `notFound()`: no multi-school landing page exists yet.
- **The ICS feed is a pure serializer** (`buildEventsIcsFeed`, `src/domain/event-ics.ts`), fed by the
  route handler and independently unit-tested — no database or request object crosses into that
  module. `allDay` emits `DTSTART;VALUE=DATE`; RFC 5545 makes that value's `DTEND` **exclusive**,
  while `endAt` is stored **inclusive** (`normalizeEventDates`), so a multi-day all-day event's
  `DTEND` is always the stored `endAt` plus one day — omitted entirely for a single-day event, which
  is where RFC 5545's implicit one-day default already lands correctly. **A timed event emits the
  school's wall-clock time, never a UTC instant**: `DTSTART;TZID=Europe/Paris:20260923T180000`
  (same for `DTEND`), with one `VTIMEZONE` block for `Europe/Paris` (EU summer-time rules) placed
  before the events and emitted only when a timed event references it, plus `X-WR-TIMEZONE`.
  `startAt`/`endAt` store the time read on the flyer in a `TIMESTAMP` column without zone, entered
  and read back as UTC digits (`parseEventInputValue`); exporting those digits with a `Z` suffix
  put an 18:00 event at 20:00 in a Paris calendar in summer (19:00 in winter). The zone is the
  single constant `EVENT_TIME_ZONE` (`src/domain/event-ics.ts`): no school carries a time zone —
  neither a `School` column nor a configuration key — and every school served today is in
  metropolitan France. A school in another zone needs a `School.timeZone` column replacing that
  constant, not a second constant. `DTSTAMP` and `LAST-MODIFIED` stay real UTC instants (`Z`):
  they are system timestamps, not wall-clock times. `UID` is `<id>@<school-slug>`: stable across edits, so a calendar client updates
  the existing entry instead of duplicating it. `SEQUENCE` is `updatedAt` in whole seconds since the
  epoch — monotonically increasing with every edit as long as two edits of the same event don't land
  in the same second, which a human editing a form never does. `STATUS:CANCELLED` mirrors the
  `CANCELLED` doctrine into the feed: the entry is kept and struck through by the calendar client,
  never removed. Text properties are escaped and lines are folded per RFC 5545 §3.1/§3.3.11, folding
  on UTF-8 octet boundaries rather than UTF-16 code units so an accented character is never split
  across a fold.
- **The J-x banner reuses `Event.announceDaysBefore`** rather than a fixed window:
  `selectAnnouncedEvent` (`src/domain/event.ts`) picks the nearest `PUBLISHED` event whose window
  (`startAt` minus `announceDaysBefore` days) has opened and which hasn't started yet; an event with
  `announceDaysBefore: null` is never selected, honouring the admin's explicit "no announcement"
  choice recorded on the field since phase 1. `CANCELLED` is excluded — the banner announces what is
  coming, it does not publish a cancellation. The banner and the read-only "Prochains événements"
  card (`(dashboard)/dashboard/_components/upcoming-events-card.tsx`) both live on the **dashboard**,
  not the public page: `EventAnnouncementBanner` renders in `(dashboard)/layout.tsx` next to
  `ImpersonationBanner`, visible to every connected member — `STAFF` viewer scope
  (`visibleEventVisibilities`) for an admin/super-admin, `MEMBER` scope for a parent — because
  `/dashboard/events` stays admin-only; these two surfaces are what let a parent see events at all
  without it. Dismissal is client-side and keyed `event-dismissed:<id>:<updatedAt>` in
  `localStorage`: editing the event changes `updatedAt`, so the key changes and the banner
  reappears — an id alone would leave a stale dismissal covering an edited announcement.
- **The banner and the card read through two different, purpose-scoped queries, not one shared
  fetch.** An earlier revision had both call `listUpcomingEvents` with a shared `take` limit so the
  two would deduplicate into a single request within a render; that broke the banner silently on any
  school whose calendar carries more than `take` upcoming rows before reaching the one event whose
  announcement window was actually open — `selectAnnouncedEvent` needs the nearest `PUBLISHED` event
  with a non-null `announceDaysBefore`, a materially smaller set than "every upcoming event" the card
  wants, so a limit sized for the card's display could exhaust itself on rows the banner could never
  select in the first place. `listAnnounceableEvents` (`src/use-cases/events/list-announceable-events.ts`)
  now feeds the banner from `eventGateway.listAnnounceable`, which filters `status: 'PUBLISHED'` and
  `announceDaysBefore: { not: null }` in the SQL `where` itself — before `take` is applied, not after
  — so the limit only ever counts rows the banner could actually choose. `listUpcomingEvents`
  (`src/use-cases/events/list-upcoming-events.ts`) keeps serving the card alone, unfiltered by
  `announceDaysBefore`, capped only for its own bounded display. Neither is memoised with
  `React.cache()` anymore: that was only ever justified by the two surfaces sharing one call, which
  no longer holds now that they read different rows.
- **The per-event public page** (`app/[locale]/ecole/[slug]/evenements/[eventSlug]/page.tsx`) goes
  through `resolveEventPageAccess` before rendering any key: an anonymous visitor only ever receives
  the image keys of a `PUBLIC`, non-`DRAFT` event; everything else is an admin-only preview or a 404.

## Invitations

`app/[locale]/(dashboard)/_lib/invitation-actions.ts`.

- Issuing, resending and revoking an invitation require an admin. **Accepting one is intentionally
  public** — that is the point of the link — but only on the path that creates the account. When the
  invited address already has one, acceptance requires a session (see below).
- **An invitation can only grant `ADMIN` or `PARENT`** — now guaranteed by the `SchoolRole` type
  itself rather than by a validation branch. Platform level is not grantable by invitation.
- **An invitation carries its school** (`Invitation.schoolId`, taken from the issuer's active
  school). Accepting it creates the `SchoolMember` first, then the `UserFamily` — that order is
  imposed by the composite foreign key `UserFamily → SchoolMember`.
- **Valid for 48 hours** from creation.
- **The invited address is stored in lower case.** `inviteSchema.email` normalizes at the only
  place `Invitation.email` is written: a mixed-case invitation would otherwise find no account and
  silently offer the sign-up form to someone who already has one. The two reads that look an account
  up from an invitation share `findAccountByEmail`
  (`app/[locale]/invite/[token]/_lib/invited-email.ts`), which lowers the needle rather than
  switching to an insensitive search — `findUnique` takes no `mode`, and an `ILIKE` would not use
  the unique index. Lowering the needle is required, not belt-and-braces: an invitation written
  before this rule can still carry a mixed case.
- **An existing account can be invited into a second school.** Issuing refuses only when the invitee
  already holds a `SchoolMember` of the target school → `alreadyMember`. `emailAlreadyUsed` survives
  on the account-creating path alone, where it still prevents a second account for one address.
- **Acceptance by an existing account demands a session whose email matches the invitation.**
  `joinSchoolAction` (`app/[locale]/invite/[token]/_lib/join-school-action.ts`) answers
  `unauthenticated` without a session and `emailMismatch` when the signed-in address differs — an
  invitation link is not a login, and it must not hand someone else's account a new membership. That
  path creates **no account**: one transaction writes the `SchoolMember` and, for a `PARENT`
  invitation carrying a family, the `UserFamily`. An unknown email still goes through account
  creation (`credentialUserGateway`).
- **The token is consumed before the membership is written.** `linkInvitedUser()` closes the
  invitation with an `updateMany` guarded by `usedAt: null`; that single conditional write is the
  only serialization point, so a link replayed twice grants one membership and answers
  `alreadyUsed`. A caller already a member of the target school is refused before it → `alreadyMember`.
- **The invitation email names the school it grants**, since the same message now reaches accounts
  that already exist elsewhere on the platform.
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

`School` is deliberately **absent** from that list even though it has `isActive`: forcing the filter
would stop an administrator from finding a deactivated school, hence from reactivating it. Where the
filter is wanted — active-school resolution, school switching, the school selector — it is written
explicitly, and where it must not apply — `schoolGateway.listAll()`, `findById()`, both reserved to
`/dashboard/schools` — its absence is deliberate.

Two consequences worth knowing:

1. The filter applies to **top-level reads only**. A nested `include`/`select` returns archived rows
   unless the query filters them explicitly.
2. A caller cannot ask for archived rows through those methods — the extension overrides a
   caller-supplied `isActive: false`. Reading archived data needs a deliberate, reviewed path.

`src/lib/db.ts` exposes that path as **`dbArchived`**: the same connection without the soft-delete
filter, but **still carrying the tenant guard**. Dropping both at once would have made a whole
administration surface invisible to the guard. It has two consumers, with distinct rights:
`src/gateways/user-gateway.ts` reads and restores archived accounts for super-admin user management,
and `src/gateways/family-gateway.ts` reads **and permanently deletes** through it — a family
deletion must see the archived rows whose foreign keys would otherwise block it.

Counting what blocks a permanent account deletion is a separate case and does **not** go through
`dbArchived`. The question — has this account created anything, anywhere on the platform? — has no
school, and it must see archived rows: an archived family still constrains the foreign key, so
ignoring it would report "deletable" and then fail on the constraint. It is therefore a named
exception, `countRowsBlockingUserDeletion` in `src/lib/db-unscoped.ts`, on a connection with neither
the guard nor the filter.

That exception does not cover every blocker. `McpApiKey` is counted through its own boundary,
`mcpApiKeyGateway.countForUser`, because the model is outside the tenant guard and has no
`isActive`: the ordinary `db` connection already sees all of its rows, so dropping the guard would
buy nothing. `McpOAuthGrant` is the opposite case: it is inside the guard, and counting it by
`userId` alone — across schools — is exactly the platform question the exception exists for, so it
is counted there with the families, invitations and transactions. `countUserDeletionBlockers` in
`src/use-cases/users/count-deletion-blockers.ts` sums both counts, and both deletion paths ask it
rather than counting for themselves.

## Known gaps

Real holes, verified against the running application. Not aspirations.

- **The disabled "record a payment" button explains itself through `title` only** — unreachable by
  keyboard, since a disabled button takes no focus, and unannounced by screen readers.
- **Manual payment cannot target a specific enrollment.** Distribution is always proportional across
  every `PENDING` or `ACTIVE` enrollment of the family.
- **A `User.email` or `Invitation.email` row written before the normalization rule keeps its mixed
  case.** Every read lowers its needle, so such a row stays invisible to the account lookups and to
  the uniqueness guard, and a case-variant duplicate created earlier still coexists under the unique
  index. Seeing them would take a case-insensitive scan, which gives up the index, or a data
  migration; neither was in the scope of #215. New rows cannot reach that state.
- **`RichDataTable` ignores changes to its `data` prop** (issue #217). Its internal state — search,
  sort, column visibility — works; a new array from the parent does not re-render the rows.
  `/dashboard/users` works around it with a `key` that remounts the table when a filter changes, at
  the cost of losing the search and sort on each change. The four other tables pass a constant list,
  so they are exposed only once a parent-driven filter is added to them.
- **`Event.startAt`/`endAt` reads shift by the server's local UTC offset when the Node process does
  not run with `TZ=UTC`** — verified against this app's own Prisma setup (`@prisma/adapter-pg`),
  reading a `TIMESTAMP(3)` (no time zone) column. A raw `pg.Client` reading the same row returns the
  stored wall-clock digits verbatim; a `db.event.findFirst()` through the app's Prisma client, run on
  a process whose OS time zone is e.g. `Africa/Cairo` (UTC+3), returns an instant three hours later —
  enough to cross midnight and change the UTC calendar day `getUTCDate()` reads, exactly the bug
  `normalizeEventDates` (`src/domain/event.ts`) exists to prevent. Docker/CI default to `TZ=UTC`,
  where this is a no-op, which is presumably why it has not surfaced before. A developer seeding or
  testing event dates locally on a non-UTC machine will see wrong days without any error. Reproduced
  and isolated while verifying #326's ICS feed; fixing it (forcing `TZ=UTC` on the Next.js process,
  or moving the affected columns to `TIMESTAMPTZ`) was out of that issue's scope. The ICS feed's
  `TZID` wall-clock export reads the same UTC digits, so on such a process it inherits the same
  shift; it is correct wherever the process runs with `TZ=UTC`.
- **"Upcoming" and the J-x banner compare wall-clock event times to `now` as if both were UTC**, so
  near the boundary an event is considered started one or two hours late (Paris offset). The ICS feed
  no longer has this defect; the comparisons would need `now` converted to `EVENT_TIME_ZONE` wall
  clock.

- **"One open enrollment per student per period" has no database constraint.** The period lives on
  the assignment's class, so no unique index on `Enrollment` can express it; the advisory lock taken
  by every writer carries it. A partial unique index on `ClassAssignment(enrollmentId) WHERE "endAt"
  IS NULL` would at least forbid two open assignments per enrollment, but needs the existing data
  checked first and was left out of the concurrency fix.
- **Cancelling an enrollment is not one transaction.** `cancel-enrollment.ts` updates the status and
  closes the assignment in two separate writes.

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
