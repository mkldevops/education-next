import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallApp } from '../install-app'
import { setInstallPrompt } from '../install-prompt'

const messages = {
  pwa: {
    install: {
      button: 'Install app',
      iosButton: 'Add to Home Screen',
      title: 'Add to Home Screen',
      stepSafari: 'Open Safari',
      stepShare: 'Tap Share',
      stepAdd: 'Tap Add',
      close: 'Close',
    },
  },
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof messages.pwa.install) => messages.pwa.install[key],
}))

function renderInstall() {
  return render(<InstallApp />)
}

function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  const prompt = vi.fn().mockResolvedValue(undefined)
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) })
  act(() => window.dispatchEvent(event))
  return { event, prompt }
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop' })
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Linux' })
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false })
})

afterEach(() => {
  setInstallPrompt(null)
  vi.restoreAllMocks()
})

describe('InstallApp', () => {
  it('offers native installation only after an event and prompts on click', async () => {
    renderInstall()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    const { event, prompt } = offerInstall()
    expect(event.defaultPrevented).toBe(true)
    expect(prompt).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    expect(prompt).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
  })

  it('consumes dismissed and failed prompts and accepts a new offer', async () => {
    renderInstall()
    offerInstall('dismissed')
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
    const second = offerInstall()
    second.prompt.mockRejectedValueOnce(new Error('unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
    offerInstall()
    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument()
  })

  it('offers a prompt captured before it mounted, e.g. on the login page', () => {
    const first = renderInstall()
    offerInstall()
    first.unmount()
    renderInstall()
    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument()
  })

  it('hides when the browser reports installation', () => {
    renderInstall()
    offerInstall()
    act(() => window.dispatchEvent(new Event('appinstalled')))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens and closes the iPad guide on request', () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    renderInstall()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }))
    expect(screen.getByRole('dialog', { name: 'Add to Home Screen' })).toBeInTheDocument()
    expect(screen.getByText('Tap Share')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hides in standalone mode', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' })
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    renderInstall()
    const { event } = offerInstall()
    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps an accessible label in compact mode', () => {
    render(<InstallApp compact />)
    offerInstall()
    const button = screen.getByRole('button', { name: 'Install app' })
    expect(button).toHaveClass('min-h-11', 'min-w-11')
    expect(screen.getByText('Install app')).toHaveClass('sr-only', 'sm:not-sr-only')
  })

  it('responds to display mode changes and removes listeners on unmount', () => {
    let standalone = false
    let change: (() => void) | undefined
    const add = vi.fn((_name, listener: () => void) => {
      change = listener
    })
    const remove = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        get matches() {
          return standalone
        },
        addEventListener: add,
        removeEventListener: remove,
      }),
    })
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderInstall()
    offerInstall()
    standalone = true
    act(() => change?.())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    unmount()
    expect(remove).toHaveBeenCalledWith('change', change)
    expect(removeWindow).toHaveBeenCalledWith('appinstalled', expect.any(Function))
    expect(removeWindow).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
  })
})
