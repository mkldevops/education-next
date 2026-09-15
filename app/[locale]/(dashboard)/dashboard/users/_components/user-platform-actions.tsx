'use client'

import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import {
  changePlatformLevelAction,
  deactivateUserAction,
  reactivateUserAction,
  revokeUserSessionsAction,
  sendPasswordResetAction,
} from '../../../_lib/user-actions'
import { DeleteUserDialog } from './delete-user-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { ImpersonateUserButton } from './impersonate-user-button'
import { LinkFamilyDialog } from './link-family-dialog'
import type { UserDetail } from './use-user-detail'
import { Section } from './user-detail-sections'
import type { MemberRow } from './users-table'

interface Props {
  user: MemberRow['user']
  detail: UserDetail | null
  families: Array<{ id: string; name: string }>
  activeSessionCount: number
  isPending: boolean
  isSelf: boolean
  canDelete: boolean
  run: (action: () => Promise<string>, successKey: string) => void
  onClose: () => void
}

export function UserPlatformActions({
  user,
  detail,
  families,
  activeSessionCount,
  isPending,
  isSelf,
  canDelete,
  run,
  onClose,
}: Props) {
  const t = useTranslations('dashboard.pages.users')

  const unlinkedFamilies = families.filter(
    (family) => !detail?.families.some((link) => link.family.id === family.id)
  )

  return (
    <Section title={t('sections.platformActions')}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input
            type="checkbox"
            checked={user.isSuperAdmin}
            onChange={(event) =>
              run(
                () =>
                  changePlatformLevelAction({
                    id: user.id,
                    isSuperAdmin: event.target.checked,
                  }),
                'platformLevelUpdated'
              )
            }
            disabled={isPending || isSelf}
            className="h-4 w-4 rounded border-alabaster"
          />
          {t('superAdmin')}
        </label>
        {isSelf && <p className="text-xs text-graphite-600">{t('cannotChangeOwnPlatformLevel')}</p>}
        <div className="flex flex-wrap gap-2">
          <EditUserDialog user={user} />
          <LinkFamilyDialog userId={user.id} families={unlinkedFamilies} />
          <ImpersonateUserButton
            userId={user.id}
            disabled={isPending || isSelf || user.isSuperAdmin || !user.isActive}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || !user.isActive}
            onClick={() => run(() => sendPasswordResetAction({ id: user.id }), 'passwordResetSent')}
          >
            {t('sendPasswordReset')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || activeSessionCount === 0}
            onClick={() => run(() => revokeUserSessionsAction({ id: user.id }), 'sessionsRevoked')}
          >
            {t('revokeSessions')}
          </Button>
          {user.isActive ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending || isSelf}
              onClick={() => run(() => deactivateUserAction({ id: user.id }), 'userDeactivated')}
            >
              {t('deactivate')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || isSelf}
              onClick={() => run(() => reactivateUserAction({ id: user.id }), 'userReactivated')}
            >
              {t('reactivate')}
            </Button>
          )}
          {canDelete && <DeleteUserDialog user={user} onDeleted={onClose} />}
        </div>
      </div>
    </Section>
  )
}
