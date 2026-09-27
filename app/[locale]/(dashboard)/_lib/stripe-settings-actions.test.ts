import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const setStripeEnabledMock = vi.fn()
const setStripeSecretMock = vi.fn()
const deleteStripeSecretMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('./auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))
vi.mock('@/use-cases/payments/stripe-settings', () => ({
  setStripeEnabled: setStripeEnabledMock,
  setStripeSecret: setStripeSecretMock,
  deleteStripeSecret: deleteStripeSecretMock,
}))

const { deleteStripeSecretAction, setStripeEnabledAction, setStripeSecretAction } = await import(
  './stripe-settings-actions'
)

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-1', isSuperAdmin: false })
  setStripeEnabledMock.mockResolvedValue('OK')
  setStripeSecretMock.mockResolvedValue('OK')
  deleteStripeSecretMock.mockResolvedValue('OK')
})

describe('setStripeEnabledAction', () => {
  it('opens on the school admin guard before writing', async () => {
    requireSchoolAdminMock.mockRejectedValue(new Error('forbidden'))

    await expect(setStripeEnabledAction(true)).rejects.toThrow('forbidden')
    expect(setStripeEnabledMock).not.toHaveBeenCalled()
  })

  it('scopes the flag to the session school and replays the layout', async () => {
    expect(await setStripeEnabledAction(true)).toBe('OK')
    expect(setStripeEnabledMock).toHaveBeenCalledWith({ schoolId: 'school-1', enabled: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('returns the refusal without revalidating', async () => {
    setStripeEnabledMock.mockResolvedValue('notConfigured')

    expect(await setStripeEnabledAction(true)).toBe('notConfigured')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('setStripeSecretAction', () => {
  it('opens on the school admin guard before writing', async () => {
    requireSchoolAdminMock.mockRejectedValue(new Error('forbidden'))

    await expect(setStripeSecretAction('secretKey', 'sk_test_1234567890')).rejects.toThrow(
      'forbidden'
    )
    expect(setStripeSecretMock).not.toHaveBeenCalled()
  })

  it('stores the secret for the session school', async () => {
    expect(await setStripeSecretAction('webhookSecret', 'whsec_1234567890')).toBe('OK')
    expect(setStripeSecretMock).toHaveBeenCalledWith({
      schoolId: 'school-1',
      kind: 'webhookSecret',
      value: 'whsec_1234567890',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it.each(['validationError', 'secretStorageNotConfigured'])(
    'returns %s without revalidating',
    async (result) => {
      setStripeSecretMock.mockResolvedValue(result)

      expect(await setStripeSecretAction('secretKey', 'bad')).toBe(result)
      expect(revalidatePathMock).not.toHaveBeenCalled()
    }
  )
})

describe('deleteStripeSecretAction', () => {
  it('opens on the school admin guard before deleting', async () => {
    requireSchoolAdminMock.mockRejectedValue(new Error('forbidden'))

    await expect(deleteStripeSecretAction('secretKey')).rejects.toThrow('forbidden')
    expect(deleteStripeSecretMock).not.toHaveBeenCalled()
  })

  it('deletes the secret of the session school', async () => {
    expect(await deleteStripeSecretAction('secretKey')).toBe('OK')
    expect(deleteStripeSecretMock).toHaveBeenCalledWith({ schoolId: 'school-1', kind: 'secretKey' })
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('returns a validation error without revalidating', async () => {
    deleteStripeSecretMock.mockResolvedValue('validationError')

    expect(await deleteStripeSecretAction('other')).toBe('validationError')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
