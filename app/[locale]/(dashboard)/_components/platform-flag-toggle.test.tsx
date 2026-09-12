import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
const toastError = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/toast', () => ({ toast: { error: (message: string) => toastError(message) } }))

import { PlatformFlagToggle } from './platform-flag-toggle'

const baseProps = { title: 'MCP', description: 'desc', enabled: false }

describe('PlatformFlagToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms the optimistic toggle once the write succeeds', async () => {
    const onSave = vi.fn(async () => 'OK' as const)
    render(<PlatformFlagToggle {...baseProps} onSave={onSave} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('checkbox')).toBeChecked()
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(true))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('rolls back the optimistic toggle when the write is typed-refused', async () => {
    const onSave = vi.fn(async () => 'unexpected')
    render(<PlatformFlagToggle {...baseProps} onSave={onSave} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('checkbox')).toBeChecked()
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked())
    expect(toastError).toHaveBeenCalledWith('error')
    expect(refresh).not.toHaveBeenCalled()
  })

  // La partie du bug que #279 nomme explicitement (`:45-48`) : un rejet — pas seulement
  // un refus typé — doit aussi revenir en arrière, via le `catch`.
  it('rolls back the optimistic toggle when the write throws', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('network down')
    })
    render(<PlatformFlagToggle {...baseProps} onSave={onSave} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('checkbox')).toBeChecked()
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked())
    expect(toastError).toHaveBeenCalledWith('error')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('associates only the description via aria-describedby when there is no hint', () => {
    const onSave = vi.fn()
    render(<PlatformFlagToggle {...baseProps} onSave={onSave} />)

    const checkbox = screen.getByRole('checkbox')
    const description = screen.getByText(baseProps.description)
    expect(checkbox).toHaveAttribute('aria-describedby', description.id)
  })

  it('associates both the description and the hint via aria-describedby when a hint is present', () => {
    const onSave = vi.fn()
    render(<PlatformFlagToggle {...baseProps} hint="be careful" onSave={onSave} />)

    const checkbox = screen.getByRole('checkbox')
    const description = screen.getByText(baseProps.description)
    const hint = screen.getByText('be careful')
    expect(checkbox).toHaveAttribute('aria-describedby', `${description.id} ${hint.id}`)
  })
})
