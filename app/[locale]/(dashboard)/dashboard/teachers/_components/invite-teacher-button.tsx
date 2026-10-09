'use client'

import { Button } from '@peaklab/ui'
import { MailPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
import { inviteTeacherAction } from '../../../_lib/invitation-actions'

type Props = {
  teacherId: string
  hasEmail: boolean
  pending: boolean
  triggerRole?: React.AriaRole
}

export function InviteTeacherButton({ teacherId, hasEmail, pending, triggerRole }: Props) {
  const t = useTranslations('dashboard.pages.teachers.invite')
  const [isPending, startTransition] = useTransition()

  const invite = () => {
    startTransition(async () => {
      const result = await inviteTeacherAction({ teacherId })
      if (result === 'OK') {
        toast.success(t(pending ? 'resent' : 'success'))
        return
      }
      toastActionError(t, result)
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      role={triggerRole}
      disabled={isPending || !hasEmail}
      title={hasEmail ? undefined : t('missingEmailHint')}
      onClick={invite}
    >
      <MailPlus className="h-4 w-4" />
      {isPending ? t('pending') : t(pending ? 'resend' : 'action')}
    </Button>
  )
}
