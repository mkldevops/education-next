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

describe('PlatformFlagToggle with confirmDisable', () => {
  const confirmDisable = {
    title: 'Disable Google?',
    description: '2 accounts would lose access',
    confirmLabel: 'Disable anyway',
    cancelLabel: 'Keep it on',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a confirmation instead of saving when currently enabled', () => {
    const onSave = vi.fn(async () => 'OK' as const)
    render(
      <PlatformFlagToggle {...baseProps} enabled onSave={onSave} confirmDisable={confirmDisable} />
    )

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(confirmDisable.description)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('commits the disable and refreshes once the admin confirms', async () => {
    const onSave = vi.fn(async () => 'OK' as const)
    render(
      <PlatformFlagToggle {...baseProps} enabled onSave={onSave} confirmDisable={confirmDisable} />
    )

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: confirmDisable.confirmLabel }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(false))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rolls back the checkbox and never saves when the admin cancels', () => {
    const onSave = vi.fn(async () => 'OK' as const)
    render(
      <PlatformFlagToggle {...baseProps} enabled onSave={onSave} confirmDisable={confirmDisable} />
    )

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: confirmDisable.cancelLabel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('enables with a single click even when confirmDisable is supplied', async () => {
    const onSave = vi.fn(async () => 'OK' as const)
    render(
      <PlatformFlagToggle
        {...baseProps}
        enabled={false}
        onSave={onSave}
        confirmDisable={confirmDisable}
      />
    )

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(true))
  })
})

describe('PlatformFlagToggle confirmDisable dismissal', () => {
  const confirmDisable = {
    title: 'Disable Google?',
    description: '2 accounts would lose access',
    confirmLabel: 'Disable anyway',
    cancelLabel: 'Keep it on',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Le composant `Dialog` ferme aussi sur Échap et sur un clic hors panneau, en
  // appelant son `setOpen` interne — jamais notre gestionnaire. Sans resynchronisation,
  // la case reste décochée sans que rien n'ait été enregistré, et la confirmation ne se
  // rouvre plus jamais : couper Google devient silencieusement impossible.
  it('rolls back and stays reopenable when the confirmation is dismissed via Escape', () => {
    const onSave = vi.fn(async () => 'OK' as const)
    render(
      <PlatformFlagToggle {...baseProps} enabled onSave={onSave} confirmDisable={confirmDisable} />
    )

    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
