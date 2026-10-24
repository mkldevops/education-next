import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '@/lib/secret-crypto'

const regionalSettingsMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: regionalSettingsMock,
}))

import {
  deleteStripeSecret,
  getStripeSettings,
  isOnlinePaymentAvailable,
  resolveCheckoutCredentials,
  resolveStripeCredentials,
  setStripeEnabled,
  setStripeSecret,
} from './stripe-settings'

type Row = { name: string; value: string; valueType: string }

const rows = new Map<string, Row>()
const rowKey = (schoolId: string, name: string) => `${schoolId}:${name}`

const gateway = {
  get: vi.fn(async (schoolId: string, name: string) => rows.get(rowKey(schoolId, name)) ?? null),
  set: vi.fn(async (schoolId: string, data: Row) => {
    rows.set(rowKey(schoolId, data.name), data)
  }),
  remove: vi.fn(async (schoolId: string, name: string) => ({
    count: rows.delete(rowKey(schoolId, name)) ? 1 : 0,
  })),
}
const gw = gateway as unknown as NonNullable<Parameters<typeof setStripeSecret>[1]>

const schoolId = 'school-1'
const secretKey = 'sk_test_school_1234567890'
const webhookSecret = 'whsec_school_1234567890'

function storeSchoolSecrets(target = schoolId) {
  rows.set(rowKey(target, 'stripe_secret_key'), {
    name: 'stripe_secret_key',
    value: encryptSecret(secretKey),
    valueType: 'TEXT',
  })
  rows.set(rowKey(target, 'stripe_webhook_secret'), {
    name: 'stripe_webhook_secret',
    value: encryptSecret(webhookSecret),
    valueType: 'TEXT',
  })
}

function setFlag(value: 'true' | 'false') {
  rows.set(rowKey(schoolId, 'stripe_enabled'), {
    name: 'stripe_enabled',
    value,
    valueType: 'BOOLEAN',
  })
}

beforeEach(() => {
  rows.clear()
  vi.clearAllMocks()
  regionalSettingsMock.mockResolvedValue({ currency: 'EUR', timeZone: 'Europe/Paris' })
  vi.stubEnv('SETTINGS_ENCRYPTION_KEY', randomBytes(32).toString('hex'))
  vi.stubEnv('STRIPE_SECRET_KEY', '')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function stubInstanceCredentials() {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_instance')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_instance')
}

describe('resolveStripeCredentials', () => {
  it("prefers the school's own credentials over the instance ones", async () => {
    stubInstanceCredentials()
    storeSchoolSecrets()

    expect(await resolveStripeCredentials(schoolId, gw)).toEqual({ secretKey, webhookSecret })
  })

  it('falls back to the instance credentials when the school has none', async () => {
    stubInstanceCredentials()

    expect(await resolveStripeCredentials(schoolId, gw)).toEqual({
      secretKey: 'sk_test_instance',
      webhookSecret: 'whsec_instance',
    })
  })

  it('never mixes a school key with the instance webhook secret', async () => {
    stubInstanceCredentials()
    storeSchoolSecrets()
    rows.delete(rowKey(schoolId, 'stripe_webhook_secret'))

    expect(await resolveStripeCredentials(schoolId, gw)).toEqual({
      secretKey: 'sk_test_instance',
      webhookSecret: 'whsec_instance',
    })
  })

  it('still resolves credentials after the school disabled Stripe', async () => {
    storeSchoolSecrets()
    setFlag('false')

    expect(await resolveStripeCredentials(schoolId, gw)).toEqual({ secretKey, webhookSecret })
  })

  it('returns null without any credentials', async () => {
    expect(await resolveStripeCredentials(schoolId, gw)).toBeNull()
  })

  it('reads only the requested school', async () => {
    storeSchoolSecrets('school-2')

    expect(await resolveStripeCredentials(schoolId, gw)).toBeNull()
  })
})

describe('resolveCheckoutCredentials', () => {
  it('returns null once the school disabled Stripe', async () => {
    storeSchoolSecrets()
    setFlag('false')

    expect(await resolveCheckoutCredentials(schoolId, gw)).toBeNull()
    expect(await isOnlinePaymentAvailable(schoolId, gw)).toBe(false)
  })

  it('treats a missing flag as enabled', async () => {
    storeSchoolSecrets()

    expect(await resolveCheckoutCredentials(schoolId, gw)).toEqual({ secretKey, webhookSecret })
    expect(await isOnlinePaymentAvailable(schoolId, gw)).toBe(true)
  })

  it('is unavailable for a school outside the euro even when configured', async () => {
    storeSchoolSecrets()
    regionalSettingsMock.mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })

    expect(await isOnlinePaymentAvailable(schoolId, gw)).toBe(false)
  })

  it('is unavailable when enabled but not configured', async () => {
    expect(await isOnlinePaymentAvailable(schoolId, gw)).toBe(false)
  })
})

describe('getStripeSettings', () => {
  it('reports statuses without ever returning a secret value', async () => {
    storeSchoolSecrets()

    const settings = await getStripeSettings(schoolId, gw)

    expect(settings).toEqual({
      enabled: true,
      secretKey: 'configured',
      webhookSecret: 'configured',
      usesEnvFallback: false,
      configured: true,
      available: true,
    })
    expect(JSON.stringify(settings)).not.toContain(secretKey)
  })

  it('reports an incomplete configuration', async () => {
    expect(await getStripeSettings(schoolId, gw)).toEqual({
      enabled: true,
      secretKey: 'notConfigured',
      webhookSecret: 'notConfigured',
      usesEnvFallback: false,
      configured: false,
      available: false,
    })
  })

  it('flags a secret encrypted with another key as unreadable', async () => {
    storeSchoolSecrets()
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', randomBytes(32).toString('hex'))

    const settings = await getStripeSettings(schoolId, gw)

    expect(settings.secretKey).toBe('unreadable')
    expect(settings.configured).toBe(false)
  })

  it('reports the instance fallback', async () => {
    stubInstanceCredentials()
    setFlag('false')

    expect(await getStripeSettings(schoolId, gw)).toMatchObject({
      enabled: false,
      usesEnvFallback: true,
      configured: true,
      available: false,
    })
  })
})

describe('setStripeEnabled', () => {
  it('refuses to enable Stripe without credentials', async () => {
    expect(await setStripeEnabled({ schoolId, enabled: true }, gw)).toBe('notConfigured')
    expect(gateway.set).not.toHaveBeenCalled()
  })

  it('enables Stripe once configured', async () => {
    storeSchoolSecrets()

    expect(await setStripeEnabled({ schoolId, enabled: true }, gw)).toBe('OK')
    expect(gateway.set).toHaveBeenCalledWith(schoolId, {
      name: 'stripe_enabled',
      value: 'true',
      valueType: 'BOOLEAN',
    })
  })

  it('always allows disabling', async () => {
    expect(await setStripeEnabled({ schoolId, enabled: false }, gw)).toBe('OK')
    expect(rows.get(rowKey(schoolId, 'stripe_enabled'))?.value).toBe('false')
  })

  it('rejects a non-boolean value', async () => {
    expect(await setStripeEnabled({ schoolId, enabled: 'true' }, gw)).toBe('validationError')
    expect(gateway.set).not.toHaveBeenCalled()
  })
})

describe('setStripeSecret', () => {
  it('stores the secret encrypted, never in clear', async () => {
    expect(await setStripeSecret({ schoolId, kind: 'secretKey', value: secretKey }, gw)).toBe('OK')

    const stored = rows.get(rowKey(schoolId, 'stripe_secret_key'))
    expect(stored?.valueType).toBe('TEXT')
    expect(stored?.value).not.toContain(secretKey)
    expect(stored?.value.startsWith('v1:')).toBe(true)
  })

  it('trims the pasted value', async () => {
    await setStripeSecret({ schoolId, kind: 'webhookSecret', value: `  ${webhookSecret}\n` }, gw)
    await setStripeSecret({ schoolId, kind: 'secretKey', value: secretKey }, gw)

    expect(await resolveStripeCredentials(schoolId, gw)).toEqual({ secretKey, webhookSecret })
  })

  it.each([
    ['secretKey', 'pk_test_publishable_1234567890'],
    ['secretKey', 'sk_test_short'],
    ['webhookSecret', 'sk_test_school_1234567890'],
    ['unknown', secretKey],
  ])('rejects %s = %s', async (kind, value) => {
    expect(await setStripeSecret({ schoolId, kind, value }, gw)).toBe('validationError')
    expect(gateway.set).not.toHaveBeenCalled()
  })

  it('refuses to store without an encryption key', async () => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '')

    expect(await setStripeSecret({ schoolId, kind: 'secretKey', value: secretKey }, gw)).toBe(
      'secretStorageNotConfigured'
    )
    expect(gateway.set).not.toHaveBeenCalled()
  })
})

describe('deleteStripeSecret', () => {
  it('removes the secret of the school', async () => {
    storeSchoolSecrets()

    expect(await deleteStripeSecret({ schoolId, kind: 'webhookSecret' }, gw)).toBe('OK')
    expect(gateway.remove).toHaveBeenCalledWith(schoolId, 'stripe_webhook_secret')
    expect(rows.has(rowKey(schoolId, 'stripe_webhook_secret'))).toBe(false)
  })

  it('rejects an unknown kind', async () => {
    expect(await deleteStripeSecret({ schoolId, kind: 'other' }, gw)).toBe('validationError')
    expect(gateway.remove).not.toHaveBeenCalled()
  })
})
