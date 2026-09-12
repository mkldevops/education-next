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
    const onSave = vi.fn(async () => 'unexpected' as never)
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
})
