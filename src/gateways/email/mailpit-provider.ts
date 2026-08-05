import type { EmailConfig, EmailMessage, EmailProvider, SendEmailResult } from '@/types/email'

export class MailpitProvider implements EmailProvider {
  constructor(private readonly config: EmailConfig) {}

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to]
    if (recipients.length === 0) return 'invalidEmail' as const

    try {
      const response = await fetch(`${this.config.apiKey}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Email: this.config.fromEmail, Name: this.config.fromName },
          To: recipients.map((email) => ({ Email: email })),
          Subject: message.subject,
          HTML: message.html,
          Text: message.text,
          ReplyTo: message.replyTo ? [{ Email: message.replyTo }] : undefined,
        }),
      })

      return response.ok ? ('OK' as const) : ('providerError' as const)
    } catch {
      return 'providerError' as const
    }
  }
}
