import { getTranslations } from 'next-intl/server'
import { sendEmail } from '@/lib/email'
import { type EmailLayoutInput, renderEmailLayout, renderEmailText } from '@/lib/email-template'

export async function sendReceiptEmail(input: {
  to: string[]
  url: string
  locale: string
  schoolName: string
  logoUrl: string | null
  number: string
  total: string
  paidAt: string
}): Promise<'OK' | 'emailError'> {
  const t = await getTranslations({ locale: input.locale, namespace: 'emails.receipt' })
  const values = {
    schoolName: input.schoolName,
    number: input.number,
    total: input.total,
    date: input.paidAt,
  }

  const content: EmailLayoutInput = {
    preheader: t('body', values),
    brand: input.schoolName,
    // Un client mail ne résout pas une adresse relative : le logo n'y passe qu'en absolu.
    ...(input.logoUrl?.startsWith('https://') ? { logoUrl: input.logoUrl } : {}),
    heading: t('heading', values),
    paragraphs: [t('body', values)],
    cta: { label: t('cta'), url: input.url },
    footer: t('footer', values),
  }

  const result = await sendEmail({
    to: input.to,
    subject: t('subject', values),
    html: renderEmailLayout(content),
    text: renderEmailText(content),
  })

  return result === 'OK' ? 'OK' : 'emailError'
}
