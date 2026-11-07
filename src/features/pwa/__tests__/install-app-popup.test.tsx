import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INSTALL_POPUP_DISMISSED_KEY, InstallAppPopup } from '../install-app-popup'
import { setInstallPrompt } from '../install-prompt'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function offerInstall() {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  const prompt = vi.fn().mockResolvedValue(undefined)
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
  act(() => window.dispatchEvent(event))
  return prompt
}

const waitForPopup = () => act(() => vi.advanceTimersByTime(2000))

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
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
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
})

afterEach(() => {
  setInstallPrompt(null)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('InstallAppPopup', () => {
  it('stays hidden while the browser offers nothing', () => {
    render(<InstallAppPopup />)
    waitForPopup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens once installable and prompts on install', () => {
    render(<InstallAppPopup />)
    const prompt = offerInstall()
    waitForPopup()

    expect(screen.getByRole('dialog', { name: 'popupTitle' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'button' }))

    expect(prompt).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('remembers « later » and stays closed on the next visit', () => {
    const first = render(<InstallAppPopup />)
    offerInstall()
    waitForPopup()
    fireEvent.click(screen.getByRole('button', { name: 'later' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(INSTALL_POPUP_DISMISSED_KEY)).not.toBeNull()

    first.unmount()
    render(<InstallAppPopup />)
    waitForPopup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('walks iOS users through the home screen steps', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' })
    render(<InstallAppPopup />)
    waitForPopup()

    expect(screen.getByText('stepShare')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'button' })).not.toBeInTheDocument()
  })
})
