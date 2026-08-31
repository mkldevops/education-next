import { Resend } from 'resend'

import type { EmailConfig, EmailMessage, EmailProvider, SendEmailResult } from '@/types/email'

export class ResendProvider implements EmailProvider {
  private client: Resend

  constructor(config: EmailConfig) {
    this.client = new Resend(config.apiKey)
    this.fromEmail = config.fromEmail
    this.fromName = config.fromName
  }

  private fromEmail: string
  private fromName: string

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const from = this.fromName ? `${this.fromName} <${this.fromEmail}>` : this.fromEmail
    const to = Array.isArray(message.to) ? message.to[0] : message.to

    try {
      const response = await this.client.emails.send({
        from,
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      })

      if (response.error) {
        const result = mapResendError(response.error)
        console.error('[email/resend] rejected', {
          from,
          to,
          subject: message.subject,
          result,
          name: response.error.name,
          message: response.error.message,
        })
        return result
      }

      return 'OK'
    } catch (error) {
      const result = mapResendCatchError(error)
      console.error('[email/resend] failed', { from, to, subject: message.subject, result }, error)
      return result
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendEmailResult[]> {
    return Promise.all(messages.map((msg) => this.send(msg)))
  }
}

function mapResendError(error: { message?: string }): SendEmailResult {
  const message = error.message || ''

  if (message.includes('invalid_email') || message.includes('email')) {
    return 'invalidEmail'
  }

  if (message.includes('authentication') || message.includes('unauthorized')) {
    return 'invalidApiKey'
  }

  if (message.includes('rate_limit') || message.includes('too many')) {
    return 'rateLimited'
  }

  return 'providerError'
}

function mapResendCatchError(error: unknown): SendEmailResult {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('authentication')) {
      return 'invalidApiKey'
    }

    if (message.includes('invalid')) {
      return 'invalidEmail'
    }

    if (message.includes('rate')) {
      return 'rateLimited'
    }
  }

  return 'providerError'
}
