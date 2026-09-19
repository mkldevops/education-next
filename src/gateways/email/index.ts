import type { EmailConfig, EmailProvider } from '@/types/email'
import { MailpitProvider } from './mailpit-provider'
import { ResendProvider } from './resend-provider'

export function createEmailProvider(config: EmailConfig): EmailProvider {
  if (config.provider === 'mailpit') return new MailpitProvider(config)
  return new ResendProvider(config)
}
