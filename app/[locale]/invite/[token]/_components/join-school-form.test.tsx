import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  joinSchoolAction: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastActionError: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: mocks.toastSuccess },
  toastActionError: mocks.toastActionError,
}))

vi.mock('../_lib/join-school-action', () => ({
  joinSchoolAction: mocks.joinSchoolAction,
}))

import { JoinSchoolForm } from './join-school-form'

const props = { token: 'invite-token', email: 'parent@example.com', schoolName: 'Al-Nour' }

describe('JoinSchoolForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('brings a signed-out user back to the invitation after sign-in', () => {
    render(<JoinSchoolForm {...props} />)

    expect(screen.getByRole('status')).toHaveTextContent('signInRequired')
    fireEvent.click(screen.getByRole('button', { name: 'signIn' }))

    expect(mocks.push).toHaveBeenCalledWith('/login?redirectTo=%2Finvite%2Finvite-token')
  })

  it('joins the school when the session matches the invited address', async () => {
    mocks.joinSchoolAction.mockResolvedValue('OK')
    render(<JoinSchoolForm {...props} signedInAs="Parent@Example.com" />)

    fireEvent.click(screen.getByRole('button', { name: 'submit' }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'))
    expect(mocks.joinSchoolAction).toHaveBeenCalledWith({ token: 'invite-token' })
  })

  it('asks a user signed in under another address to switch account', () => {
    render(<JoinSchoolForm {...props} signedInAs="other@example.com" />)

    expect(screen.getByRole('status')).toHaveTextContent('wrongAccount')
    expect(screen.queryByRole('button', { name: 'submit' })).toBeNull()
  })
})
