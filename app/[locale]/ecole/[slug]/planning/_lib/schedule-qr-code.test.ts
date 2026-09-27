import { afterEach, describe, expect, it, vi } from 'vitest'

const headersMock = vi.fn()
vi.mock('next/headers', () => ({ headers: headersMock }))

const { buildScheduleQrCode } = await import('./schedule-qr-code')

describe('buildScheduleQrCode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    headersMock.mockReset()
  })

  it('uses the configured application URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test')

    const qrCode = await buildScheduleQrCode('/ecole/al-nour/planning')

    expect(qrCode?.url).toBe('https://app.example.test/ecole/al-nour/planning')
    expect(qrCode?.src).toMatch(/^data:image\/svg\+xml;utf8,/)
    expect(headersMock).not.toHaveBeenCalled()
  })

  it('never trusts request headers in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')

    await expect(buildScheduleQrCode('/ecole/al-nour/planning')).resolves.toBeNull()
    expect(headersMock).not.toHaveBeenCalled()
  })

  it('falls back to the request host in development', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    headersMock.mockResolvedValue(new Headers({ host: 'localhost:8550' }))

    const qrCode = await buildScheduleQrCode('/ecole/al-nour/planning')

    expect(qrCode?.url).toBe('http://localhost:8550/ecole/al-nour/planning')
  })
})
