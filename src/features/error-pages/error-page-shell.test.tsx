import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorPageShell } from './error-page-shell'

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('ErrorPageShell', () => {
  it('renders the background grid via a token-derived utility class instead of a hardcoded rgba literal', () => {
    const { container } = render(
      <ErrorPageShell statusCode="404" title="Not found" description="Nothing here" />
    )

    expect(container.innerHTML).not.toContain('rgba(53,53,53')
    expect(container.querySelector('.error-page-grid')).not.toBeNull()
  })
})
