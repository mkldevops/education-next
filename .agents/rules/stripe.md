---

paths:

- "src/lib/stripe.ts"
- "app/api/stripe/**"
- "src/use-cases/payments/**"
- "src/gateways/**"
- "prisma/schema.prisma"

---

# Stripe Rules

Scope: Stripe client, webhook routes, online payment use cases and their persistence

## Credentials per school

`src/lib/stripe.ts` caches one client per secret key, not a singleton: two schools may settle on two
distinct Stripe accounts. Resolve credentials for the school being paid (school settings, otherwise
the instance fallback `readEnvStripeCredentials()`, which returns both variables or nothing). Never
expose a secret key or webhook secret to client code, logs, or error payloads.

## Represent money exactly

Send integer amounts in the currency's smallest unit and keep the currency beside the amount. Do not
assume two decimals for every currency, and avoid binary floating-point arithmetic on money.

## Webhooks are untrusted, repeatable input

`app/api/stripe/webhook/route.ts` (instance credentials) and `app/api/stripe/webhook/[schoolId]/route.ts`
(per-school credentials) both delegate to `handle-webhook.ts`. Preserve its order:

1. Reject a missing signature or missing credentials with `400`.
2. Verify `Stripe-Signature` with `webhooks.constructEvent` against the exact raw body
   (`request.text()`) before acting on the event.
3. Handle only the checkout events the product needs; acknowledge the others.
4. Pass `providerEventId` to the use case. The `@unique` constraint on it is the durable
   deduplication; `duplicate` is an acknowledged result, not an error.
5. Return `2xx` only once the payment is durably recorded or the result can never change on replay.

On the per-school route, `schoolId` restricts which transaction the event may close. Stripe may retry
and reorder events; keep each transition idempotent.

## Fulfillment stays server-side

Never mark a payment paid from a browser redirect. Only verified webhook state records a payment.
Preserve the project's authorization checks around the family and school a checkout belongs to.
