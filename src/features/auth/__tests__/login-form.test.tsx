import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/actions', () => ({
  getPasskeyAuthenticationOptions: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
}))

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
