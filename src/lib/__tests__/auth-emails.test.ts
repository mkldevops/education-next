import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendPlatformEmailMock = vi.fn()

vi.mock('@/lib/platform-email', () => ({ sendPlatformEmail: sendPlatformEmailMock }))

// Vrai formateur ICU sur les deux catalogues : le test prouve que chaque clé existe en
// français et en anglais, et que les valeurs (`email`, `newEmail`) sont bien interpolées.
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl')
  const catalogs = {
    fr: (await import('../../../messages/fr.json')).default,
    en: (await import('../../../messages/en.json')).default,
  }
  return {
    getTranslations: async ({ locale, namespace }: { locale: 'fr' | 'en'; namespace: string }) =>
      createTranslator({ locale, messages: catalogs[locale], namespace } as never),
  }
})

const { sendChangeEmailConfirmationEmail, sendResetPasswordEmail, sendVerificationEmail } =
  await import('../auth-emails')

function requestWith(headers: Record<string, string>) {
  return new Request('http://localhost/api/auth/request-password-reset', { headers })
}

const user = { email: 'parent@example.com' }
const url = 'http://localhost:8550/reset-password?token=abc'

describe('auth emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the password reset in the language of the request cookie', async () => {
    await sendResetPasswordEmail({ user, url }, requestWith({ cookie: 'NEXT_LOCALE=en' }))

    expect(sendPlatformEmailMock).toHaveBeenCalledWith(
      'parent@example.com',
      'Reset your password',
      expect.objectContaining({
        heading: 'Reset your password',
        cta: { label: 'Choose a password', url },
        notice: 'This link expires in 1 hour.',
      })
    )
  })

  it('falls back to Accept-Language, then to French', async () => {
    await sendResetPasswordEmail(
      { user, url },
      requestWith({ 'accept-language': 'en-GB,en;q=0.8' })
    )
    await sendResetPasswordEmail({ user, url })

    expect(sendPlatformEmailMock).toHaveBeenNthCalledWith(
      1,
      'parent@example.com',
      'Reset your password',
      expect.anything()
    )
    expect(sendPlatformEmailMock).toHaveBeenNthCalledWith(
      2,
      'parent@example.com',
      'Réinitialisation de votre mot de passe',
      expect.objectContaining({ cta: { label: 'Choisir un mot de passe', url } })
    )
  })

  it('names the verified address in the verification email', async () => {
    await sendVerificationEmail({ user, url }, requestWith({ cookie: 'NEXT_LOCALE=en' }))

    expect(sendPlatformEmailMock).toHaveBeenCalledWith(
      'parent@example.com',
      'Confirm your email address',
      expect.objectContaining({
        paragraphs: [expect.stringContaining('the account parent@example.com')],
        cta: { label: 'Confirm my address', url },
      })
    )
  })

  it('sends the change confirmation to the current address, naming both addresses', async () => {
    await sendChangeEmailConfirmationEmail(
      { user, newEmail: 'new@example.com', url },
      requestWith({ cookie: 'NEXT_LOCALE=fr' })
    )

    expect(sendPlatformEmailMock).toHaveBeenCalledWith(
      'parent@example.com',
      "Confirmez le changement d'adresse email",
      expect.objectContaining({
        preheader: 'Nouvelle adresse demandée : new@example.com',
        paragraphs: [
          'Une demande de remplacement de parent@example.com par new@example.com a été enregistrée pour ce compte.',
          expect.stringContaining("l'adresse du compte reste inchangée"),
        ],
        notice: "Après confirmation, la connexion se fera avec l'adresse new@example.com.",
        cta: { label: 'Confirmer la nouvelle adresse', url },
      })
    )
  })
})
