import { getTranslations } from 'next-intl/server'
import { resolveRequestLocale } from '@/i18n/request-locale'
import { sendPlatformEmail } from '@/lib/platform-email'

/**
 * Emails des callbacks Better Auth (`src/lib/auth.ts`). Ces callbacks reçoivent la
 * requête HTTP d'origine en second argument : sa locale (cookie `NEXT_LOCALE`, puis
 * `Accept-Language`) choisit la langue du message, comme pour les autres emails de
 * la plateforme. Un appel serveur sans requête tombe sur la locale par défaut.
 */

type EmailNamespace = 'emails.resetPassword' | 'emails.verifyEmail' | 'emails.changeEmail'

async function translator(namespace: EmailNamespace, request?: Request) {
  return getTranslations({ locale: resolveRequestLocale(request), namespace })
}

export async function sendResetPasswordEmail(
  data: { user: { email: string }; url: string },
  request?: Request
) {
  const t = await translator('emails.resetPassword', request)
  await sendPlatformEmail(data.user.email, t('subject'), {
    preheader: t('preheader'),
    heading: t('heading'),
    paragraphs: [t('body')],
    cta: { label: t('cta'), url: data.url },
    notice: t('notice'),
    footer: t('footer'),
  })
}

export async function sendVerificationEmail(
  data: { user: { email: string }; url: string },
  request?: Request
) {
  const t = await translator('emails.verifyEmail', request)
  await sendPlatformEmail(data.user.email, t('subject'), {
    preheader: t('preheader'),
    heading: t('heading'),
    paragraphs: [t('body', { email: data.user.email })],
    cta: { label: t('cta'), url: data.url },
    notice: t('notice'),
    footer: t('footer'),
  })
}

/**
 * La confirmation part sur l'adresse **actuelle**, seule déjà vérifiée : un détournement
 * de compte ne peut donc pas se valider depuis la nouvelle adresse choisie par l'attaquant.
 */
export async function sendChangeEmailConfirmationEmail(
  data: { user: { email: string }; newEmail: string; url: string },
  request?: Request
) {
  const t = await translator('emails.changeEmail', request)
  const values = { email: data.user.email, newEmail: data.newEmail }
  await sendPlatformEmail(data.user.email, t('subject'), {
    preheader: t('preheader', values),
    heading: t('heading'),
    paragraphs: [t('body', values), t('bodyCurrentAddress')],
    cta: { label: t('cta'), url: data.url },
    notice: t('notice', values),
    footer: t('footer'),
  })
}
