/**
 * Drapeau d'école gouvernant le paiement en ligne, distinct de `payments_enabled` : couper
 * Stripe laisse la gestion des paiements et la saisie manuelle en place.
 *
 * L'absence de ligne vaut **activé** (`readsAsEnabled`) : une instance configurée par
 * variables d'environnement garde son paiement en ligne sans qu'une école ait à le rouvrir.
 * Le verdict effectif exige en plus des identifiants lisibles.
 */
export const STRIPE_ENABLED_CONFIG_KEY = 'stripe_enabled'

/**
 * Secrets Stripe de l'école, stockés **chiffrés** (`encryptSecret`). Hors de
 * `SchoolConfigKey` : l'éditeur générique de `/dashboard/config` ne doit ni les afficher ni
 * les écrire en clair.
 */
const STRIPE_SECRET_KEY_CONFIG_KEY = 'stripe_secret_key'
const STRIPE_WEBHOOK_SECRET_CONFIG_KEY = 'stripe_webhook_secret'

export const StripeSecretKind = {
  SecretKey: 'secretKey',
  WebhookSecret: 'webhookSecret',
} as const

export type StripeSecretKind = (typeof StripeSecretKind)[keyof typeof StripeSecretKind]

export const STRIPE_SECRET_CONFIG_KEYS: Record<StripeSecretKind, string> = {
  [StripeSecretKind.SecretKey]: STRIPE_SECRET_KEY_CONFIG_KEY,
  [StripeSecretKind.WebhookSecret]: STRIPE_WEBHOOK_SECRET_CONFIG_KEY,
}

/** Réglages qu'aucune lecture générique (`getConfig`) ne renvoie, même chiffrés. */
export const STRIPE_PRIVATE_CONFIG_KEYS: readonly string[] =
  Object.values(STRIPE_SECRET_CONFIG_KEYS)

/** Point d'entrée que l'école déclare dans son tableau de bord Stripe. */
export function stripeWebhookPath(schoolId: string) {
  return `/api/stripe/webhook/${schoolId}`
}
