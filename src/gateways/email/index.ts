import type { EmailConfig, EmailProvider } from '@/types/email'
import { ResendProvider } from './resend-provider'

export type { EmailConfig, EmailProvider }
export { ResendProvider }

export function createEmailProvider(config: EmailConfig): EmailProvider {
  return new ResendProvider(config)
}
