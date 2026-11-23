import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useRouter: () => router,
}))

vi.mock('@/actions', () => ({
  getPasskeyAuthenticationOptions: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
}))

import { signIn } from '@/lib/auth-client'
import { LoginForm } from '../login-form'

const button = (name: string) => screen.queryByRole('button', { name })

describe('LoginForm sign-in methods', () => {
  it('offers both alternatives when the platform enables them', () => {
    render(<LoginForm googleEnabled passkeyEnabled />)

    expect(button('signInWithGoogle')).not.toBeNull()
    expect(button('signInWithPasskey')).not.toBeNull()
    expect(screen.queryByText('or')).not.toBeNull()
  })

  it('hides google when the platform disables it', () => {
    render(<LoginForm googleEnabled={false} passkeyEnabled />)

    expect(button('signInWithGoogle')).toBeNull()
    expect(button('signInWithPasskey')).not.toBeNull()
  })

  it('drops the separator when email and password is the only method left', () => {
    render(<LoginForm googleEnabled={false} passkeyEnabled={false} />)

    expect(button('signInWithGoogle')).toBeNull()
    expect(button('signInWithPasskey')).toBeNull()
    expect(screen.queryByText('or')).toBeNull()
    expect(button('submit')).not.toBeNull()
  })
})

describe('LoginForm handleGoogleSignIn', () => {
  beforeEach(() => {
    vi.mocked(signIn.social).mockReset()
  })

  it('calls signIn.social with the google provider and dashboard callback on click', async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null } as never)

    render(<LoginForm googleEnabled passkeyEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    await waitFor(() =>
      expect(signIn.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/dashboard' })
    )
  })

  it('sends google back to the requested page after sign-in', async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null } as never)

    render(<LoginForm googleEnabled passkeyEnabled={false} redirectTo="/invite/abc" />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    await waitFor(() =>
      expect(signIn.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/invite/abc' })
    )
  })

  it('shows a pending label while google redirects', async () => {
    vi.mocked(signIn.social).mockReturnValue(new Promise(() => {}) as never)

    render(<LoginForm googleEnabled passkeyEnabled />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    expect(await screen.findByRole('button', { name: 'googlePending' })).toBeDisabled()
    expect(button('signInWithPasskey')).toBeDisabled()
  })

  it('shows the google error message when signIn.social rejects', async () => {
    vi.mocked(signIn.social).mockRejectedValue(new Error('network error'))

    render(<LoginForm googleEnabled passkeyEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('googleError')
  })

  it('shows the google error message when signIn.social resolves with an error', async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: { message: 'oauth' } } as never)

    render(<LoginForm googleEnabled passkeyEnabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'signInWithGoogle' }))

    expect(await screen.findByText('googleError')).not.toBeNull()
  })
})

describe('LoginForm handleSubmit', () => {
  beforeEach(() => {
    vi.mocked(signIn.email).mockReset()
    router.push.mockReset()
    router.replace.mockReset()
    router.refresh.mockReset()
  })

  it('replaces the login entry so Back cannot reopen the login page', async () => {
    vi.mocked(signIn.email).mockResolvedValue({ data: {}, error: null } as never)

    const { container } = render(
      <LoginForm googleEnabled={false} passkeyEnabled={false} redirectTo="/dashboard/students" />
    )
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard/students'))
    expect(router.refresh).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('stays on the login page when the credentials are rejected', async () => {
    vi.mocked(signIn.email).mockResolvedValue({ data: null, error: { status: 401 } } as never)

    const { container } = render(<LoginForm googleEnabled={false} passkeyEnabled={false} />)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('error')
    expect(router.replace).not.toHaveBeenCalled()
  })
})
