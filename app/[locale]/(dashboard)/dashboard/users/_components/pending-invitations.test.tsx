import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PendingInvitations } from './pending-invitations'

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}))

vi.mock('./invitation-actions-cell', () => ({
  InvitationActionsCell: ({ invitationId }: { invitationId: string }) => (
    <button type="button">Actions {invitationId}</button>
  ),
}))

const labels = {
  email: 'Email',
  role: 'Role',
  family: 'Family',
  expiresAt: 'Expires on',
  expired: 'Expired',
  actions: 'Actions',
  none: 'No pending invitations',
}

describe('PendingInvitations', () => {
  it('renders a compact card alongside the desktop table for constrained widths', () => {
    const { container } = render(
      <PendingInvitations
        invitations={[
          {
            id: 'invitation-1',
            email: 'new.parent@example.test',
            role: 'PARENT',
            family: { name: 'Said' },
            expiresAt: new Date('2999-09-18T00:00:00Z'),
          },
        ]}
        labels={labels}
        roleLabels={{
          ADMIN: 'Administrator',
          PARENT: 'Parent',
          TEACHER: 'Teacher',
          CASHIER: 'Cashier',
        }}
        locale="en"
      />
    )

    const compactCard = container.querySelector('article')
    expect(compactCard).not.toBeNull()
    expect(within(compactCard as HTMLElement).getByText('new.parent@example.test')).toBeVisible()
    expect(within(compactCard as HTMLElement).getByText('Said')).toBeVisible()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Actions invitation-1' })).toHaveLength(2)
  })

  it('keeps the empty state concise in both responsive presentations', () => {
    render(
      <PendingInvitations
        invitations={[]}
        labels={labels}
        roleLabels={{
          ADMIN: 'Administrator',
          PARENT: 'Parent',
          TEACHER: 'Teacher',
          CASHIER: 'Cashier',
        }}
        locale="en"
      />
    )

    expect(screen.getAllByText('No pending invitations')).toHaveLength(2)
  })
})
