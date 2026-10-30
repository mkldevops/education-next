import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fr from '../../../../messages/fr.json'
import { ServiceWorkerRegister } from '../service-worker-register'
import { watchServiceWorkerUpdates } from '../service-worker-updates'

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('../service-worker-updates', () => ({ watchServiceWorkerUpdates: vi.fn() }))
const register = vi.fn()
const update = vi.fn()
const cleanup = vi.fn()

function renderStatus() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <ServiceWorkerRegister />
    </NextIntlClientProvider>
  )
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

describe('PWA status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    setOnline(true)
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } })
    update.mockResolvedValue(undefined)
    register.mockResolvedValue({ update })
    vi.mocked(watchServiceWorkerUpdates).mockReturnValue(cleanup)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setOnline(true)
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('shows the offline indicator and a single reconnection notice', () => {
    renderStatus()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    setOnline(false)
    fireEvent(window, new Event('offline'))
    expect(screen.getByRole('status')).toHaveTextContent('Connexion interrompue')
    setOnline(true)
    fireEvent(window, new Event('online'))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Connexion rétablie.')
    fireEvent(window, new Event('online'))
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('detects a page opened offline even without service worker support', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    setOnline(false)
    renderStatus()
    expect(screen.getByRole('status')).toHaveTextContent('Connexion interrompue')
  })

  it('keeps the update action explicit and disabled while offline', async () => {
    renderStatus()
    await waitFor(() => expect(watchServiceWorkerUpdates).toHaveBeenCalled())
    const offer = vi.mocked(watchServiceWorkerUpdates).mock.calls[0][2]
    const apply = vi.fn()
    act(() => offer(apply))
    expect(apply).not.toHaveBeenCalled()
    expect(screen.getByText('Une nouvelle version est disponible')).toBeInTheDocument()
    setOnline(false)
    fireEvent(window, new Event('offline'))
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeDisabled()
    setOnline(true)
    fireEvent(window, new Event('online'))
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Mise à jour…' })).toBeDisabled()
  })

  it('checks for updates when connectivity returns and releases listeners on unmount', async () => {
    const { unmount } = renderStatus()
    await waitFor(() => expect(watchServiceWorkerUpdates).toHaveBeenCalled())
    fireEvent(window, new Event('online'))
    expect(update).toHaveBeenCalledTimes(1)
    unmount()
    fireEvent(window, new Event('online'))
    expect(update).toHaveBeenCalledTimes(1)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('retries a failed registration when connectivity returns', async () => {
    register.mockRejectedValueOnce(new TypeError('Offline'))
    renderStatus()
    await act(async () => {})
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(watchServiceWorkerUpdates).toHaveBeenCalled())
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('handles a failed registration without breaking the page', async () => {
    register.mockRejectedValueOnce(new TypeError('Offline'))
    renderStatus()
    await act(async () => {})
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(watchServiceWorkerUpdates).not.toHaveBeenCalled()
  })
})
