import type { EmailConfig, EmailProvider } from '@/types/email'
import { ResendProvider } from './resend-provider'

export { ResendProvider }
export type { EmailConfig, EmailProvider }

export function createEmailProvider(config: EmailConfig): EmailProvider {
  return new ResendProvider(config)
}
