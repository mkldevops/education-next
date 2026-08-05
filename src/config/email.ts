import type { EmailConfig, EmailProviderType } from '@/types/email'

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getEmailProvider(): EmailProviderType {
  const provider = process.env.EMAIL_PROVIDER as EmailProviderType | undefined
  if (!provider || !['resend', 'brevo', 'mailpit'].includes(provider)) {
    throw new Error(`Invalid EMAIL_PROVIDER: ${provider}. Must be 'resend', 'brevo' or 'mailpit'`)
  }
  return provider
}

function getApiKey(provider: EmailProviderType): string {
  if (provider === 'mailpit') {
    return process.env.MAILPIT_URL || 'http://localhost:8553'
  }
  if (provider === 'resend') {
    return getRequiredEnv('RESEND_API_KEY')
  }
  return getRequiredEnv('BREVO_API_KEY')
}

export function getEmailConfig(): EmailConfig {
  const provider = getEmailProvider()

  return {
    provider,
    apiKey: getApiKey(provider),
    fromEmail: getRequiredEnv('EMAIL_FROM'),
    fromName: process.env.EMAIL_FROM_NAME || 'Newsletter',
    adminEmail: getRequiredEnv('ADMIN_EMAIL'),
  }
}

export function isEmailConfigured(): boolean {
  try {
    getEmailConfig()
    return true
  } catch {
    return false
  }
}
