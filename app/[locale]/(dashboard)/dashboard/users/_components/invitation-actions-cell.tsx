'use client'

import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { resendInvitationAction, revokeInvitationAction } from '../../../_lib/invitation-actions'

type Props = {
  invitationId: string
}

export function InvitationActionsCell({ invitationId }: Props) {
  const t = useTranslations('dashboard.pages.users.invitations')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const run = (
    action: typeof resendInvitationAction,
    successKey: 'resendSuccess' | 'revokeSuccess'
  ) => {
    startTransition(async () => {
      const result = await action({ id: invitationId })
      if (result === 'OK') {
        toast.success(t(successKey))
        router.refresh()
      } else {
        toastActionError(t, result)
      }
    })
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => run(resendInvitationAction, 'resendSuccess')}
      >
        {t('resend')}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => run(revokeInvitationAction, 'revokeSuccess')}
      >
        {t('revoke')}
      </Button>
    </div>
  )
}
