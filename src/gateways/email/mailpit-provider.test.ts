import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailConfig } from '@/types/email'
import { MailpitProvider } from './mailpit-provider'

const config: EmailConfig = {
  provider: 'mailpit',
  apiKey: 'http://localhost:8553',
  fromEmail: 'noreply@school.test',
  fromName: 'École',
  adminEmail: 'admin@school.test',
}

describe('MailpitProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the message to the local inbox', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await new MailpitProvider(config).send({
      to: 'parent@school.test',
      subject: 'Reset',
      html: '<p>link</p>',
    })

    expect(result).toBe('OK')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8553/api/v1/send')
    expect(JSON.parse(init.body)).toMatchObject({
      From: { Email: 'noreply@school.test' },
      To: [{ Email: 'parent@school.test' }],
      Subject: 'Reset',
    })
  })

  it('rejects an empty recipient list', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await new MailpitProvider(config).send({ to: [], subject: 's', html: 'h' })).toBe(
      'invalidEmail'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps transport failures to a provider error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    expect(
      await new MailpitProvider(config).send({ to: 'a@b.test', subject: 's', html: 'h' })
    ).toBe('providerError')
  })
})
