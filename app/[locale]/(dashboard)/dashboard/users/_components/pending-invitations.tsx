import { Card, type Column, DataTable } from '@peaklab/ui'
import { formatDate } from '@/lib/date'
import type { SchoolRole } from '@/types/enums'
import { InvitationActionsCell } from './invitation-actions-cell'

type PendingInvitation = {
  id: string
  email: string
  role: SchoolRole
  expiresAt: Date
  family: { name: string } | null
}

type Labels = {
  email: string
  role: string
  family: string
  expiresAt: string
  expired: string
  actions: string
  none: string
}

type Props = {
  invitations: PendingInvitation[]
  labels: Labels
  roleLabels: Record<SchoolRole, string>
  locale: string
}

export function PendingInvitations({ invitations, labels, roleLabels, locale }: Props) {
  const expiresAt = (invitation: PendingInvitation) =>
    invitation.expiresAt < new Date() ? labels.expired : formatDate(invitation.expiresAt, locale)

  const columns: Column<PendingInvitation>[] = [
    {
      key: 'email',
      header: labels.email,
      className: 'font-medium',
      render: (invitation) => invitation.email,
    },
    {
      key: 'role',
      header: labels.role,
      className: 'text-graphite',
      render: (invitation) => roleLabels[invitation.role],
    },
    {
      key: 'family',
      header: labels.family,
      className: 'text-graphite',
      render: (invitation) => invitation.family?.name ?? '-',
    },
    {
      key: 'expiresAt',
      header: labels.expiresAt,
      className: 'text-graphite',
      render: expiresAt,
    },
    {
      key: 'actions',
      header: labels.actions,
      headerClassName: 'text-right',
      className: 'text-right',
      render: (invitation) => <InvitationActionsCell invitationId={invitation.id} />,
    },
  ]

  return (
    <Card className="rounded border border-alabaster-700">
      <div className="divide-y divide-alabaster-800 lg:hidden">
        {invitations.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-graphite-600">{labels.none}</p>
        ) : (
          invitations.map((invitation) => (
            <article key={invitation.id} className="space-y-4 p-4">
              <div className="min-w-0">
                <p className="break-all text-sm font-medium text-graphite">{invitation.email}</p>
                <p className="mt-1 text-sm text-graphite-600">{roleLabels[invitation.role]}</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-graphite-500">
                    {labels.family}
                  </dt>
                  <dd className="mt-1 truncate text-graphite">{invitation.family?.name ?? '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-graphite-500">
                    {labels.expiresAt}
                  </dt>
                  <dd className="mt-1 text-graphite">{expiresAt(invitation)}</dd>
                </div>
              </dl>
              <div className="border-t border-alabaster-800 pt-3">
                <InvitationActionsCell invitationId={invitation.id} />
              </div>
            </article>
          ))
        )}
      </div>
      <div className="hidden lg:block">
        <DataTable
          data={invitations}
          columns={columns}
          getRowKey={(invitation) => invitation.id}
          emptyMessage={labels.none}
        />
      </div>
    </Card>
  )
}
