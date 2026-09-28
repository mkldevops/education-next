import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../../../../messages/en.json'
import fr from '../../../../../../messages/fr.json'
import type { MemberRow } from './users-table'
import { UsersTable } from './users-table'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}))

vi.mock('./invite-user-dialog', () => ({
  InviteUserDialog: () => <button type="button">invite.button</button>,
}))

vi.mock('./user-drawer', () => ({
  UserDrawer: () => null,
}))

const inactiveMember: MemberRow = {
  userId: 'user-1',
  role: 'PARENT',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  user: {
    id: 'user-1',
    name: 'Amina Said',
    email: 'amina@example.test',
    emailVerified: true,
    image: null,
    isSuperAdmin: false,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  family: { id: 'family-1', name: 'Said' },
  lastLoginAt: null,
}

const renderTable = (members: MemberRow[]) =>
  render(
    <UsersTable
      members={members}
      canManagePlatform={false}
      currentUserId="viewer-1"
      families={[]}
      locale="fr"
    />
  )

describe('UsersTable', () => {
  it('defines localized labels for search and filters', () => {
    expect(fr.dashboard.pages.users).toMatchObject({
      searchPlaceholder: 'Rechercher un utilisateur...',
      filters: 'Filtres',
    })
    expect(en.dashboard.pages.users).toMatchObject({
      searchPlaceholder: 'Search users...',
      filters: 'Filters',
    })
  })

  it('shows an actionable empty state when the school has no members', () => {
    renderTable([])

    expect(screen.getByText('empty.title')).toBeInTheDocument()
    expect(screen.getByText('empty.description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'invite.button' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument()
  })

  it('shows all statuses by default, then explains and clears an empty filtered state', async () => {
    renderTable([inactiveMember])

    expect(screen.getByText('amina@example.test')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'filterStatus' }))
    const activeOption = await screen.findByRole('option', { name: 'active' })
    fireEvent.pointerDown(activeOption)
    fireEvent.click(activeOption)

    expect(await screen.findByText('empty.filteredTitle')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'empty.clearFilters' }))

    expect(screen.getByText('amina@example.test')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'filterStatus' })).toHaveTextContent('statusAll')
  })
})
