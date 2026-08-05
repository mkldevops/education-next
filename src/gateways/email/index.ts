import type { EmailConfig, EmailProvider } from '@/types/email'
import { MailpitProvider } from './mailpit-provider'
import { ResendProvider } from './resend-provider'

export type { EmailConfig, EmailProvider }
export { MailpitProvider, ResendProvider }

export function createEmailProvider(config: EmailConfig): EmailProvider {
  if (config.provider === 'mailpit') return new MailpitProvider(config)
  return new ResendProvider(config)
}
