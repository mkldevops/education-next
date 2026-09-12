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

## Multi-school

Every business row belongs to exactly one `School`. Nineteen models carry `schoolId NOT NULL`:
`Family`, `UserFamily`, `Person`, `FamilyPerson`, `Student`, `PhoneNumber`, `Config`, `Level`,
`Period`, `ClassPeriod`, `ClassPeriodTeacher`, `Enrollment`, `ClassAssignment`, `Payment`,
`PaymentTransaction`, `Plan`, `Invitation`, `Teacher`, `TeacherExpense`.

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
toggle goes enabled → disabled while the count is greater than zero (`PlatformFlagToggle`'s
`confirmDisable`, `app/[locale]/(dashboard)/_components/platform-flag-toggle.tsx`). Re-enabling
stays the original one-click toggle, and so does disabling when the count is zero — the
confirmation is additive friction on top of the existing optimistic toggle, not a new toggle shape.
The passkey toggle in the same **Sign-in methods** section never receives it either, and neither do
the school-switch toggle in **Schools** or the MCP toggle in **Integrations** — the two other
sections of the same page.

The recovery path itself needs no code: `/forgot-password` and `/reset-password` are public and read
no platform flag. Better Auth's `resetPassword` handler creates the missing `credential` `Account`
when none exists instead of requiring one, so a Google-only account can request the reset e-mail and
set a password from it after the flag is off, exactly as the confirmation names.

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
- **There is no public sign-up.** `/register` was removed: a self-created account would hold no
  membership and be locked out of every school. Invitations are the only way in.

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
  deletion would have erased exactly the evidence this rule promises to keep.
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
any request that does not present a well-formed key → retention sweep → platform flag → scope →
per-key rate limit → handler. Reading the credential and checking its shape are pure operations, so
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
| `unauthorized` | 401 | no key, malformed key, unknown, revoked or expired |
| `forbidden` | 403 | deactivated account, deactivated school, non-`ADMIN` membership |
| `tooManyRequests` | 429 | address tier exhausted by traffic without a well-formed key, or key tier exhausted |
| `methodNotAllowed` | 405 | `GET` or `DELETE` |

No `WWW-Authenticate: Bearer resource_metadata=…` and no `.well-known` route: the application operates no
authorization server, and advertising that flow would send clients into a discovery loop.

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

**The lock is single-pass**: `claim()` is a conditional `updateMany` on `(id, schoolId, keyId, tool,
checksum, status: PENDING, expiresAt > now)`, never a read followed by a write. A client that
retries after a network cut must see exactly one commit win; the loser re-reads the draft and
returns the **recorded result**, which is the correct answer to a replay, not a second family.

**A draft belongs to the key that proposed it.** `keyId` is part of the claim condition, and a draft
presented by another key of the same school is refused as `draftNotFound` rather than as forbidden.
The resolved plan freezes the proposing key's user in `createdById`: without that binding, a revoked
key's plan would still land, signed by its owner.

**The lock always has an exit.** The result is written by the same transaction that writes the data,
so a `COMMITTED` draft with a null `result` provably wrote nothing. Two ways out follow from that: a
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
MCP traffic is the only available clock, and it is also the only traffic that creates
drafts. Like the rate-limit counters, the interval is in-process: horizontal scaling multiplies the
sweeps, which an idempotent `deleteMany` does not mind.

The delete itself is a named tenant-guard exception, `purgeExpiredMcpDrafts` in
`src/lib/db-unscoped.ts`, called by `mcpDraftGateway.purgeExpired` — which remains the model's single
boundary. A retention sweep has no `schoolId` to offer, and the guard rejects an unscoped
`deleteMany` on `db`; enumerating the schools to delete school by school would describe nothing the
rows still belong to.

`commit_enroll_family` owns **one `db.$transaction`** with direct `tx.*` calls, like
`create-enrollment.ts`: no gateway accepts an injected client, and chaining the four use cases would
leave an orphan family behind the first failure.

| Body | Cause |
|---|---|
| `validationError` | malformed `draftId`/`checksum`, or a stored plan of an older shape |
| `draftNotFound` | unknown draft, one belonging to the other tool, or one proposed by another key |
| `draftExpired` | past the thirty minutes |
| `checksumMismatch` | the checksum does not match the plan that was shown |
| `commitInProgress` | a concurrent commit is still inside its transaction, and under 60 s old |
| `notFound` | the class the preview resolved no longer exists |
| `classFull` | the class filled up between the preview and the commit |
| `overpayment` / `noPayableEnrollments` / `refundExceedsPaid` | the fresh balances refuse the amount |
| `staleDraft` | the recomputed split no longer matches the validated one |

A refusal writes nothing and unlocks the draft, so the caller may fix the cause or preview again
without waiting out the timeout.

**The two pairs chain.** `enroll_family` creates its enrollments `PENDING`, and `record_payment`
distributes across `PENDING` and `ACTIVE` ones alike — so a family enrolled through the MCP can pay
its next instalment before an admin validates the enrollment. Validation stays a dashboard decision;
collecting money does not wait for it.

These discriminants answer an agent, not a dialog, so they carry no `messages/*.json` entry — the
rule in [Surfacing a rule in the UI](#surfacing-a-rule-in-the-ui) applies to screens.

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
  sent, payment transactions initiated, machine API keys held (`hasRelatedRecords`). The dialog also
  requires the target's email to be typed back; a mismatch answers `confirmationMismatch`. Sessions,
  accounts, passkeys and family links cascade with the row; `McpApiKey` deliberately does not.
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
- **The cycle walk only sees one school's levels.** `checkCircularReference` is pure; its map is
  built from `levelGateway.list(schoolId)` in `src/use-cases/levels/set-next-level.ts`.

## Classes

Owner: `src/domain/class-period.ts`, `src/use-cases/class-periods/`.

- **Capacity is per class**, stored on `ClassPeriod.capacity`, required at creation and a positive
  integer. The `max_students_per_class` config only supplies the default value in the creation form.
- **A class is full** when `currentEnrolled >= capacity` → `classFull`.
- **Capacity cannot drop below current occupancy** → `capacityBelowEnrolled`.
- **Occupancy counts** assignments with `endAt: null` whose enrollment is `PENDING`, `ACTIVE` or
  `COMPLETED`. Cancelled enrollments free their seat; completed ones do not.
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

### One family balance

**A family pays, not a student.** Four children enrolled at 180 make one debt of 720, settled in as
many payments as the family wants. `calculateFamilyBalance()` in
`src/use-cases/payments/family-balance.ts` computes that single figure:

| Figure | Covers |
|---|---|
| `remainingBalance` | `PENDING` + `ACTIVE` enrollments, across every period |
| `remainingAmountInCents` | the same figure, as the integer Stripe charges |

An enrollment awaiting validation is owed and payable: the money is collected when the family hands
it over, not when an admin gets to the enrollment. `CANCELLED` and `COMPLETED` enrollments are out.

### Recording a payment

`recordPayment()` never targets one enrollment. It takes a family-level amount and **distributes it
across that family's `PENDING` and `ACTIVE` enrollments**, proportionally to each remaining balance.

- **No enrollment left to pay** → `noPayableEnrollments`.
- **More than the family owes** → `overpayment`. The sum of remaining balances is the ceiling.
- **Rounding is absorbed by the last enrollment**: earlier parts are rounded half-up and capped at
  their own remaining balance, and the last one takes `amount - alreadyDistributed`. The parts
  always sum to exactly the amount received.
- **Zero is rejected** by the schema; a negative amount is a refund.
- **Several payments are normal.** Each one is distributed against the balances left by the
  previous ones, until the family owes nothing.

### Displaying a payment

The database keeps **one `Payment` row per enrollment**, so each enrollment knows what it received.
Screens show what the family handed over instead: `groupFamilyPayments()` in
`src/domain/payment.ts` folds the rows of one payment back into a single line with its split.

- **Rows belong to one payment** when family, method, reference, payment date, cash date and
  transaction all match, and they were written within five seconds of each other.
- **One enrollment appears at most once per payment**, so two identical cash payments recorded back
  to back stay two payments.
- Enrollment pages still show the part that enrollment received.

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
- Nothing owed → `noBalance`. The session is always opened for the **full `remainingBalance`**,
  pending enrollments included; partial online payment is not offered.
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
- **Updating a family member** (`src/use-cases/families/update-family-person.ts`) requires the person
  to already be linked to the family → `notFound` otherwise. Person fields, relation type and the
  primary phone number are written in one transaction; `phoneNumber: null` deactivates that number
  instead of deleting it, and the first active number is the one edited.
- **A person's sex and a student's birthday are optional** — `Person.sex` and `Student.birthday`
  are nullable. A paper enrollment sheet often carries neither, and a required field forced the
  operator to invent a value that then read as real data. A form left blank sends `undefined` on
  create and `null` on update, which clears the column; age is simply not shown.
- **A family may be created without any parent**, on the dashboard and through `enroll_family` alike.
- **A student's birthday, when given, must be in the past** → `validationError`
  (`src/domain/student.ts`).
- **A student carrying a `PENDING` or `ACTIVE` enrollment cannot be archived**
  → `hasActiveEnrollments`.
- **A family cannot be archived either while any of its students holds one** — same discriminant,
  counted across every person linked to the family.

## Configuration

`src/use-cases/config/set-config.ts`. Values are stored as strings with a declared type, **scoped to
one school**.

- `NUMBER` must parse as a number, `BOOLEAN` must be exactly `'true'` or `'false'`, otherwise
  → `invalidConfigValue`. `TEXT` and `COLOR` accept anything.
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
  `src/lib/teacher-expense-config.ts`), `logo_url` and `favicon_url`
  (`src/lib/branding-config.ts`), and `theme_primary`, `theme_primary_hover`,
  `theme_primary_light`, `theme_background` (`src/components/theme-provider.tsx`).
- **The school name is no longer a `Config` entry.** It lives on `School.name`, the single source of
  truth; keeping the old `school_name` key would have let two screens edit two different names. The
  migration copies it over and deletes the key.

## Branding images

`src/use-cases/media/upload-branding-image.ts`, `src/gateways/storage-gateway.ts`.

`logo_url` and `favicon_url` accept either a URL typed by hand or a file uploaded to the object
store. Both end up as a plain string in `Config`, so an external URL keeps working.

- Uploading requires an admin.
- **Accepted types**: PNG, JPEG, WebP, SVG, ICO. Anything else → `unsupportedType`.
- **1 MB maximum**, and an empty file is refused → `fileTooLarge` / `emptyFile`.
- The object is stored under `branding/<schoolId>/<uuid>.<ext>`; the caller never chooses the key,
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

The cookie remains the fallback, for surfaces that may be requested without a session — `app/icon.tsx`
and `app/manifest.ts`. With neither signal, the platform default applies. The theme itself is read in
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
  invitation carrying a family, the `UserFamily`. An unknown email still goes through sign-up.
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
administration surface invisible to the guard. Its only consumer is `src/gateways/user-gateway.ts`,
which powers super-admin user management: the list can show archived accounts, and `reactivateUser`
can restore one.

Counting what blocks a permanent account deletion is a separate case and does **not** go through
`dbArchived`. The question — has this account created anything, anywhere on the platform? — has no
school, and it must see archived rows: an archived family still constrains the foreign key, so
ignoring it would report "deletable" and then fail on the constraint. It is therefore a named
exception, `countRowsBlockingUserDeletion` in `src/lib/db-unscoped.ts`, on a connection with neither
the guard nor the filter.

That exception does not cover every blocker. `McpApiKey` is counted through its own boundary,
`mcpApiKeyGateway.countForUser`, because the model is outside the tenant guard and has no
`isActive`: the ordinary `db` connection already sees all of its rows, so dropping the guard would
buy nothing. `countUserDeletionBlockers` in `src/use-cases/users/count-deletion-blockers.ts` sums
both counts, and both deletion paths ask it rather than counting for themselves.

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
