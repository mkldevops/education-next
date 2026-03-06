export type EmailProviderType = 'resend' | 'brevo'

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface EmailConfig {
  provider: EmailProviderType
  apiKey: string
  fromEmail: string
  fromName: string
  adminEmail: string
}

export type SendEmailResult =
  | 'OK'
  | 'invalidEmail'
  | 'invalidApiKey'
  | 'rateLimited'
  | 'providerError'

export interface EmailProvider {
  send(message: EmailMessage): Promise<SendEmailResult>
  sendBatch?(messages: EmailMessage[]): Promise<SendEmailResult[]>
}

export interface EmailProviderError {
  code: SendEmailResult
  message: string
  originalError?: unknown
}
