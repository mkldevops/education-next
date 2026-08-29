import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  useRouter: () => router,
}))

vi.mock('@/actions/school-actions', () => ({
  switchSchoolAction: (schoolId: string) => switchSchoolAction(schoolId),
}))

vi.mock('@/lib/auth-client', () => ({
  signOut: vi.fn(),
}))

import type { AuthorizedSchool } from '@/domain/school-scope'
import type { SchoolRole } from '@/types/enums'
import { Sidebar } from '../sidebar'
import { useSidebarStore } from '../sidebar-store'

const renderSidebar = (role: SchoolRole | null, isSuperAdmin = false) =>
  render(<Sidebar role={role} isSuperAdmin={isSuperAdmin} />)

const school = (id: string, name: string): AuthorizedSchool => ({
  id,
  name,
  slug: name.toLowerCase(),
  isAdmin: true,
})

const ADMIN: SchoolRole = 'ADMIN'

const renderSwitcher = (schools: AuthorizedSchool[]) =>
  render(
    <Sidebar
      role={ADMIN}
      isSuperAdmin={false}
      schoolName="Al-Nour"
      schools={schools}
      activeSchoolId="school-a"
    />
  )

const router = { replace: vi.fn(), refresh: vi.fn() }
const switchSchoolAction = vi.fn(async (_schoolId: string) => 'OK' as const)

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

describe('Sidebar school switcher', () => {
  beforeEach(() => {
    expand()
    router.refresh.mockClear()
    switchSchoolAction.mockClear()
    switchSchoolAction.mockResolvedValue('OK' as const)
  })

  it('renders a static brand when the caller belongs to a single school', () => {
    renderSwitcher([school('school-a', 'Al-Nour')])

    expect(screen.queryByRole('button', { name: /Al-Nour/ })).not.toBeInTheDocument()
    expect(screen.getByText('Al-Nour')).toBeInTheDocument()
  })

  it('lists every authorized school behind the switcher trigger', () => {
    renderSwitcher([school('school-a', 'Al-Nour'), school('school-b', 'Horizon')])

    const trigger = screen.getByRole('button', { name: /Al-Nour/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(screen.getByRole('menuitem', { name: /Al-Nour/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Horizon/ })).toBeInTheDocument()
  })

  it('switches the active school and replays the layout', async () => {
    renderSwitcher([school('school-a', 'Al-Nour'), school('school-b', 'Horizon')])

    fireEvent.click(screen.getByRole('button', { name: /Al-Nour/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Horizon/ }))

    await waitFor(() => expect(switchSchoolAction).toHaveBeenCalledWith('school-b'))
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
  })

  it('keeps the current school when the switch is refused', async () => {
    switchSchoolAction.mockResolvedValue('notFound' as never)

    renderSwitcher([school('school-a', 'Al-Nour'), school('school-b', 'Horizon')])

    fireEvent.click(screen.getByRole('button', { name: /Al-Nour/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Horizon/ }))

    await waitFor(() => expect(switchSchoolAction).toHaveBeenCalledWith('school-b'))
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('exposes school administration to a super admin only', () => {
    renderSidebar(null, true)
    expect(screen.getByRole('link', { name: 'schools' })).toBeInTheDocument()

    cleanup()
    renderSidebar('ADMIN')
    expect(screen.queryByRole('link', { name: 'schools' })).not.toBeInTheDocument()
  })
})
