'use client'

import { Button, StatusBadge } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import type { UserDetail } from './use-user-detail'
import type { MemberRow } from './users-table'

type SessionRow = UserDetail['sessions'][number]

export const formatDateTime = (value: Date | string, locale: string) =>
  new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={mono ? 'font-mono text-xs text-gray-700' : 'text-sm text-gray-900'}>
        {value}
      </span>
    </div>
  )
}

export function IdentitySection({ user, locale }: { user: MemberRow['user']; locale: string }) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Section title={t('sections.identity')}>
      <Field label={t('name')} value={user.name || '-'} />
      <Field label={t('email')} value={user.email} />
      <Field label={t('userId')} value={user.id} mono />
      <Field label={t('createdAt')} value={formatDateTime(user.createdAt, locale)} />
      <Field label={t('updatedAt')} value={formatDateTime(user.updatedAt, locale)} />
    </Section>
  )
}

interface FamiliesSectionProps {
  detail: UserDetail | null
  canUnlink: boolean
  isPending: boolean
  onUnlink: (familyId: string) => void
}

export function FamiliesSection({ detail, canUnlink, isPending, onUnlink }: FamiliesSectionProps) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Section title={t('sections.families')}>
      {detail && detail.families.length === 0 && (
        <p className="text-sm text-gray-500">{t('noFamily')}</p>
      )}
      {detail?.families.map(({ family }) => (
        <div key={family.id} className="rounded border border-gray-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{family.name}</p>
              {!family.isActive && (
                <StatusBadge status="gray" label={t('archivedFamily')} className="mt-1" />
              )}
            </div>
            {canUnlink && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => onUnlink(family.id)}
              >
                {t('unlinkFamily')}
              </Button>
            )}
          </div>
          <ul className="mt-2 space-y-1">
            {family.persons.map(({ person, relationType }) => (
              <li key={person.id} className="text-sm text-gray-600">
                {person.name} {person.lastname}
                <span className="text-gray-400"> · {relationType}</span>
                {person.student && (
                  <span className="text-gray-400">
                    {' '}
                    · {t('enrollmentCount', { count: person.student._count.enrollments })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  )
}

interface SecuritySectionProps {
  detail: UserDetail | null
  loading: boolean
  activeSessions: SessionRow[]
  locale: string
}

export function SecuritySection({ detail, loading, activeSessions, locale }: SecuritySectionProps) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Section title={t('sections.security')}>
      <Field label={t('activeSessions')} value={loading ? '…' : String(activeSessions.length)} />
      <Field label={t('passkeys')} value={String(detail?._count.passkeys ?? 0)} />
      <Field
        label={t('linkedAccounts')}
        value={
          detail && detail.accounts.length > 0
            ? detail.accounts.map((account) => account.providerId).join(', ')
            : '-'
        }
      />
      {activeSessions.length > 0 && (
        <ul className="space-y-2">
          {activeSessions.slice(0, 5).map((session) => (
            <li key={session.id} className="rounded bg-gray-50 p-2 text-xs text-gray-600">
              <p className="font-medium text-gray-800">{session.ipAddress || '-'}</p>
              <p className="truncate">{session.userAgent || '-'}</p>
              <p className="text-gray-400">
                {formatDateTime(session.createdAt, locale)} →{' '}
                {formatDateTime(session.expiresAt, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {detail && detail.passkeys.length > 0 && (
        <ul className="space-y-1">
          {detail.passkeys.map((passkey) => (
            <li key={passkey.id} className="text-sm text-gray-600">
              {passkey.name}
              <span className="text-gray-400"> · {passkey.deviceType}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

interface ActivitySectionProps {
  detail: UserDetail | null
  lastLoginAt: Date | null
  locale: string
}

export function ActivitySection({ detail, lastLoginAt, locale }: ActivitySectionProps) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')

  return (
    <Section title={t('sections.activity')}>
      <Field
        label={t('lastLogin')}
        value={lastLoginAt ? formatDateTime(lastLoginAt, locale) : t('neverConnected')}
      />
      <Field label={t('createdFamilies')} value={String(detail?._count.createdFamilies ?? 0)} />
      <Field
        label={t('createdInvitations')}
        value={String(detail?._count.createdInvitations ?? 0)}
      />
      <Field
        label={t('paymentTransactions')}
        value={String(detail?._count.paymentTransactions ?? 0)}
      />
      {detail && detail.createdInvitations.length > 0 && (
        <ul className="space-y-1">
          {detail.createdInvitations.map((invitation) => (
            <li key={invitation.id} className="text-sm text-gray-600">
              {invitation.email}
              <span className="text-gray-400">
                {' '}
                · {tRoles(invitation.role)} · {formatDateTime(invitation.createdAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
