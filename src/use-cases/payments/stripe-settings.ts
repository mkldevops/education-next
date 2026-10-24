import { z } from 'zod'
import { readsAsEnabled } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { decryptSecret, encryptSecret } from '@/lib/secret-crypto'
import { readEnvStripeCredentials, type StripeCredentials } from '@/lib/stripe'
import {
  STRIPE_ENABLED_CONFIG_KEY,
  STRIPE_SECRET_CONFIG_KEYS,
  StripeSecretKind,
} from '@/lib/stripe-config'

type ConfigGateway = Pick<typeof configGateway, 'get' | 'set' | 'remove'>

export type StripeSecretStatus = 'configured' | 'notConfigured' | 'unreadable'

export type StripeSettings = {
  /** Drapeau tel qu'enregistré ; le paiement n'est proposé que si `available`. */
  enabled: boolean
  secretKey: StripeSecretStatus
  webhookSecret: StripeSecretStatus
  /** L'école n'a pas de configuration complète et l'instance fournit la sienne. */
  usesEnvFallback: boolean
  /** Des identifiants lisibles existent, de l'école ou de l'instance. */
  configured: boolean
  /** Verdict effectif : activé **et** configuré. */
  available: boolean
}

/**
 * Formats publiés par Stripe : clé secrète (`sk_`) ou restreinte (`rk_`), secret de
 * signature (`whsec_`). Le préfixe écarte l'erreur courante — coller la clé publiable.
 */
const secretSchemas: Record<StripeSecretKind, z.ZodType<string>> = {
  [StripeSecretKind.SecretKey]: z
    .string()
    .trim()
    .max(500)
    .regex(/^(sk|rk)_(test|live)_\S{10,}$/),
  [StripeSecretKind.WebhookSecret]: z
    .string()
    .trim()
    .max(500)
    .regex(/^whsec_\S{10,}$/),
}

const secretKindSchema = z.enum(StripeSecretKind)

type DecryptedSecret = { status: StripeSecretStatus; value: string | null }

async function readSecret(
  schoolId: string,
  kind: StripeSecretKind,
  configGw: ConfigGateway
): Promise<DecryptedSecret> {
  const row = await configGw.get(schoolId, STRIPE_SECRET_CONFIG_KEYS[kind])
  if (!row?.value) return { status: 'notConfigured', value: null }

  const plain = decryptSecret(row.value)
  return plain === 'notConfigured' || plain === 'unreadable'
    ? { status: 'unreadable', value: null }
    : { status: 'configured', value: plain }
}

async function readSchoolStripe(schoolId: string, configGw: ConfigGateway) {
  const [flag, secretKey, webhookSecret] = await Promise.all([
    configGw.get(schoolId, STRIPE_ENABLED_CONFIG_KEY),
    readSecret(schoolId, StripeSecretKind.SecretKey, configGw),
    readSecret(schoolId, StripeSecretKind.WebhookSecret, configGw),
  ])

  const schoolCredentials: StripeCredentials | null =
    secretKey.value && webhookSecret.value
      ? { secretKey: secretKey.value, webhookSecret: webhookSecret.value }
      : null

  return { enabled: readsAsEnabled(flag?.value), secretKey, webhookSecret, schoolCredentials }
}

/**
 * Identifiants de l'école, sinon ceux de l'instance. Jamais un mélange : une clé d'école
 * avec le secret de webhook de l'instance signerait pour un compte et vérifierait pour
 * un autre.
 *
 * Ne lit pas le drapeau : le webhook doit encore vérifier un paiement déjà capturé après
 * une coupure.
 */
export async function resolveStripeCredentials(
  schoolId: string,
  configGw: ConfigGateway = configGateway
): Promise<StripeCredentials | null> {
  const { schoolCredentials } = await readSchoolStripe(schoolId, configGw)
  return schoolCredentials ?? readEnvStripeCredentials()
}

/** Identifiants utilisables pour ouvrir une session, ou `null` si l'école a coupé Stripe. */
export async function resolveCheckoutCredentials(
  schoolId: string,
  configGw: ConfigGateway = configGateway
): Promise<StripeCredentials | null> {
  const { enabled, schoolCredentials } = await readSchoolStripe(schoolId, configGw)
  if (!enabled) return null
  return schoolCredentials ?? readEnvStripeCredentials()
}

/** État affichable : jamais une valeur, seulement sa présence et sa lisibilité. */
export async function getStripeSettings(
  schoolId: string,
  configGw: ConfigGateway = configGateway
): Promise<StripeSettings> {
  const { enabled, secretKey, webhookSecret, schoolCredentials } = await readSchoolStripe(
    schoolId,
    configGw
  )
  const usesEnvFallback = !schoolCredentials && readEnvStripeCredentials() !== null
  const configured = schoolCredentials !== null || usesEnvFallback

  return {
    enabled,
    secretKey: secretKey.status,
    webhookSecret: webhookSecret.status,
    usesEnvFallback,
    configured,
    available: enabled && configured,
  }
}

/** Seule devise des sessions Checkout en v1 : une école en KMF encaisse au guichet. */
export const STRIPE_CURRENCY = 'EUR'

export async function isStripeCurrency(schoolId: string): Promise<boolean> {
  return (await getSchoolRegionalSettings(schoolId)).currency === STRIPE_CURRENCY
}

export async function isOnlinePaymentAvailable(
  schoolId: string,
  configGw: ConfigGateway = configGateway
): Promise<boolean> {
  if (!(await isStripeCurrency(schoolId))) return false
  return (await resolveCheckoutCredentials(schoolId, configGw)) !== null
}

/**
 * Activer sans identifiants lisibles est permis : c'est ce qui ouvre leur saisie. Le bouton
 * parent ne suit que `available`, activé **et** configuré.
 */
export async function setStripeEnabled(
  input: { schoolId: string; enabled: unknown },
  configGw: ConfigGateway = configGateway
) {
  const parsed = z.boolean().safeParse(input.enabled)
  if (!parsed.success) return 'validationError' as const

  await configGw.set(input.schoolId, {
    name: STRIPE_ENABLED_CONFIG_KEY,
    value: String(parsed.data),
    valueType: 'BOOLEAN',
  })
  return 'OK' as const
}

/**
 * Chiffré avant d'atteindre `Config`. `secretStorageNotConfigured` : sans
 * `SETTINGS_ENCRYPTION_KEY`, refuser vaut mieux que stocker en clair.
 */
export async function setStripeSecret(
  input: { schoolId: string; kind: unknown; value: unknown },
  configGw: ConfigGateway = configGateway
) {
  const kind = secretKindSchema.safeParse(input.kind)
  if (!kind.success) return 'validationError' as const

  const value = secretSchemas[kind.data].safeParse(input.value)
  if (!value.success) return 'validationError' as const

  const encrypted = encryptSecret(value.data)
  if (encrypted === 'notConfigured') return 'secretStorageNotConfigured' as const

  await configGw.set(input.schoolId, {
    name: STRIPE_SECRET_CONFIG_KEYS[kind.data],
    value: encrypted,
    valueType: 'TEXT',
  })
  return 'OK' as const
}

export async function deleteStripeSecret(
  input: { schoolId: string; kind: unknown },
  configGw: ConfigGateway = configGateway
) {
  const kind = secretKindSchema.safeParse(input.kind)
  if (!kind.success) return 'validationError' as const

  await configGw.remove(input.schoolId, STRIPE_SECRET_CONFIG_KEYS[kind.data])
  return 'OK' as const
}
