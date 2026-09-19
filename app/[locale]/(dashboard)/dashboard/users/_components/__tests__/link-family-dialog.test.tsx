import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
const linkUserFamilyAction = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key
    t.has = () => false
    return t
  },
}))

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh }) }))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  toastActionError: vi.fn(),
}))

vi.mock('../../../../_lib/user-actions', () => ({
  linkUserFamilyAction: (input: unknown) => linkUserFamilyAction(input),
}))

import { LinkFamilyDialog } from '../link-family-dialog'

const families = [{ id: 'family-1', name: 'Famille Diallo' }]

describe('LinkFamilyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const submit = () => {
    fireEvent.click(screen.getByRole('button', { name: 'linkFamily' }))
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
  }

  it('notifies the drawer so it refetches the user detail after a successful link', async () => {
    linkUserFamilyAction.mockResolvedValue('OK')
    const onLinked = vi.fn()

    render(<LinkFamilyDialog userId="user-1" families={families} onLinked={onLinked} />)
    submit()

    await waitFor(() => expect(onLinked).toHaveBeenCalledTimes(1))
    expect(linkUserFamilyAction).toHaveBeenCalledWith({ id: 'user-1', familyId: 'family-1' })
    expect(refresh).toHaveBeenCalled()
  })

  it('does not notify the drawer when the link is refused', async () => {
    linkUserFamilyAction.mockResolvedValue('forbidden')
    const onLinked = vi.fn()

    render(<LinkFamilyDialog userId="user-1" families={families} onLinked={onLinked} />)
    submit()

    await waitFor(() => expect(linkUserFamilyAction).toHaveBeenCalled())
    expect(onLinked).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
