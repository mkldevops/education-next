import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({
  signOut: vi.fn(),
}))

import type { Role } from '@/types/enums'
import { Sidebar } from '../sidebar'
import { useSidebarStore } from '../sidebar-store'

const renderSidebar = (role: Role) => render(<Sidebar {...{ role }} />)

const collapse = () => useSidebarStore.setState({ expanded: false, mobileOpen: false })
const expand = () => useSidebarStore.setState({ expanded: true, mobileOpen: false })

describe('Sidebar accessibility', () => {
  beforeEach(() => {
    collapse()
  })

  it('gives every collapsed navigation link an accessible name', () => {
    renderSidebar('SUPER_ADMIN')

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAccessibleName()
    }
  })

  it('gives the collapsed logout and expand buttons an accessible name', () => {
    renderSidebar('ADMIN')

    expect(screen.getByRole('button', { name: 'logout' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'expand' })).toBeInTheDocument()
  })

  it('shows the tooltip on keyboard focus and links it with aria-describedby', () => {
    renderSidebar('ADMIN')

    const link = screen.getByRole('link', { name: 'families' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.focus(link)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('families')
    expect(link).toHaveAttribute('aria-describedby', tooltip.id)
  })

  it('hides the tooltip on blur', () => {
    renderSidebar('ADMIN')

    const link = screen.getByRole('link', { name: 'families' })
    fireEvent.focus(link)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.blur(link)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows the tooltip on hover', () => {
    renderSidebar('ADMIN')

    const link = screen.getByRole('link', { name: 'students' })
    fireEvent.mouseEnter(link.parentElement as HTMLElement)

    expect(screen.getByRole('tooltip')).toHaveTextContent('students')
  })

  it('keeps visible labels and no redundant aria-label when expanded', () => {
    expand()
    renderSidebar('ADMIN')

    const link = screen.getByRole('link', { name: 'families' })
    expect(link).not.toHaveAttribute('aria-label')
    expect(link).toHaveTextContent('families')
    expect(screen.getByRole('button', { name: 'collapse' })).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
