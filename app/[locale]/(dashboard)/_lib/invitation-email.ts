import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { sendEmail } from '@/lib/email'
import { type EmailLayoutInput, renderEmailLayout, renderEmailText } from '@/lib/email-template'

export function resolveInvitationLocale(value: string | undefined): string {
  return routing.locales.includes(value as never) ? (value as string) : routing.defaultLocale
}

export async function sendInvitationEmail(input: {
  to: string
  token: string
  locale: string
  schoolName: string
  /**
   * `reminder` porte le texte d'une relance : le lien précédent vient d'être
   * remplacé, ce que la première invitation ne peut pas dire.
   */
  variant?: 'invitation' | 'reminder'
}): Promise<'OK' | 'emailError'> {
  const locale = resolveInvitationLocale(input.locale)
  const namespace = input.variant === 'reminder' ? 'emails.invitationReminder' : 'emails.invitation'
  const t = await getTranslations({ locale, namespace })
  const schoolName = input.schoolName

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550'
  const inviteUrl = `${appUrl}/${locale}/invite/${input.token}`

  const content: EmailLayoutInput = {
    preheader: t('body', { schoolName }),
    brand: schoolName,
    heading: t('heading', { schoolName }),
    paragraphs: [t('body', { schoolName })],
    cta: { label: t('cta'), url: inviteUrl },
    notice: t('expiry'),
    footer: t('footer', { schoolName }),
  }

  const result = await sendEmail({
    to: input.to,
    subject: t('subject', { schoolName }),
    html: renderEmailLayout(content),
    text: renderEmailText(content),
  })

  return result === 'OK' ? 'OK' : 'emailError'
}
