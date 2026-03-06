import { getEmailConfig } from '@/config/email'
import { createEmailProvider } from '@/gateways/email'
import type { EmailMessage, EmailProvider, SendEmailResult } from '@/types/email'

let emailProvider: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    const config = getEmailConfig()
    emailProvider = createEmailProvider(config)
  }
  return emailProvider
}

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const provider = getEmailProvider()
  return provider.send(message)
}

export async function sendEmailBatch(messages: EmailMessage[]): Promise<SendEmailResult[]> {
  const provider = getEmailProvider()
  if (provider.sendBatch) {
    return provider.sendBatch(messages)
  }
  return Promise.all(messages.map((msg) => provider.send(msg)))
}
