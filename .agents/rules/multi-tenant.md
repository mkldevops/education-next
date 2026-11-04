# Multi-tenant Isolation

Scope: always loaded (security-critical)

Each `School` is a tenant; school-owned models carry a `schoolId`.

- Derive `schoolId` from the authenticated server context (the `auth-helper.ts` guards, the resolved MCP
  scope) or from a verified mapping such as a per-school webhook secret. Never trust a `schoolId`, slug
  or family identifier sent by the client on its own.
- Scope every school-owned read, write, update, delete, cache key, file key and background operation
  to the authorized `schoolId`. A gateway or use case receives the scope as a non-optional argument.
- Authorize the caller's membership and role in that school for the requested resource, not merely the
  existence of a session. Parents are further limited to their linked `familyId`.
- Cross-school administration goes through `requirePlatformAdmin()` (`isSuperAdmin`) only; keep it
  explicit, narrow and separately tested.
- Public per-school routes (`app/api/schools/[slug]/…`) expose only data the school publishes.
- Test the negative case: a caller from school A must not read or mutate a resource of school B.
