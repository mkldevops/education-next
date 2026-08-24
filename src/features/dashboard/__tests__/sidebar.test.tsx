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

import type { SchoolRole } from '@/types/enums'
import { Sidebar } from '../sidebar'
import { useSidebarStore } from '../sidebar-store'

const renderSidebar = (role: SchoolRole | null, isSuperAdmin = false) =>
  render(<Sidebar role={role} isSuperAdmin={isSuperAdmin} />)

const collapse = () => useSidebarStore.setState({ expanded: false, mobileOpen: false })
const expand = () => useSidebarStore.setState({ expanded: true, mobileOpen: false })

describe('Sidebar accessibility', () => {
  beforeEach(() => {
    collapse()
  })

  it('gives every collapsed navigation link an accessible name', () => {
    renderSidebar(null, true)

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAccessibleName()
    }
  })

  it('exposes logout and expand through the collapsed user menu', () => {
    renderSidebar('ADMIN')

    const trigger = screen.getByRole('button', { name: 'account' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'logout' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'expand' })).toBeInTheDocument()
  })

  it('closes the user menu on Escape', () => {
    renderSidebar('ADMIN')

    const trigger = screen.getByRole('button', { name: 'account' })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /account/ }))
    expect(screen.getByRole('menuitem', { name: 'collapse' })).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
