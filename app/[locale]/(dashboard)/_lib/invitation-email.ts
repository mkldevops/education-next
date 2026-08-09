import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { sendEmail } from '@/lib/email'

export function resolveInvitationLocale(value: string | undefined): string {
  return routing.locales.includes(value as never) ? (value as string) : routing.defaultLocale
}

export async function sendInvitationEmail(input: {
  to: string
  token: string
  locale: string
}): Promise<'OK' | 'emailError'> {
  const locale = resolveInvitationLocale(input.locale)
  const t = await getTranslations({ locale, namespace: 'emails.invitation' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550'
  const inviteUrl = `${appUrl}/${locale}/invite/${input.token}`

  const result = await sendEmail({
    to: input.to,
    subject: t('subject'),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${t('heading')}</h2>
        <p>${t('body')}</p>
        <p>
          <a href="${inviteUrl}" style="display: inline-block; background: #3c6e71; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            ${t('cta')}
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">${t('expiry')}</p>
      </div>
    `,
    text: `${t('body')} ${inviteUrl} — ${t('expiry')}`,
  })

  return result === 'OK' ? 'OK' : 'emailError'
}
