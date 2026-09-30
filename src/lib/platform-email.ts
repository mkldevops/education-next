import { sendEmail } from '@/lib/email'
import { type EmailLayoutInput, renderEmailLayout, renderEmailText } from '@/lib/email-template'
import type { SendEmailResult } from '@/types/email'

/**
 * Marque des emails émis hors contexte d'école : les callbacks Better Auth
 * (réinitialisation, vérification d'adresse, confirmation de changement
 * d'adresse) n'ont pas de `schoolId`, et un compte peut de toute façon
 * appartenir à plusieurs écoles — aucune ne peut signer ces messages à sa
 * place. Leur langue, elle, suit la requête (`src/lib/auth-emails.ts`).
 */
const PLATFORM_BRAND = 'Education'

/**
 * Émet un email plateforme rendu par le gabarit partagé. Centralisé pour que
 * les quatre messages transactionnels portent la même marque et aient tous leur
 * variante texte, qu'un appelant ne peut donc pas oublier.
 */
export async function sendPlatformEmail(
  to: string,
  subject: string,
  content: Omit<EmailLayoutInput, 'brand'>
): Promise<SendEmailResult> {
  const layout: EmailLayoutInput = { ...content, brand: PLATFORM_BRAND }

  return sendEmail({
    to,
    subject,
    html: renderEmailLayout(layout),
    text: renderEmailText(layout),
  })
}
