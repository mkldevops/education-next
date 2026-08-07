'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import {
  activateEnrollmentAction,
  cancelEnrollmentAction,
  completeEnrollmentAction,
} from '../../../_lib/enrollment-actions'

type Props = {
  enrollmentId: string
  status: string
}

export function EnrollmentActions({ enrollmentId, status }: Props) {
  const router = useRouter()
  const t = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const [isPending, startTransition] = useTransition()

  const handleActivate = () => {
    startTransition(async () => {
      const result = await activateEnrollmentAction({ id: enrollmentId })
      if (result === 'OK') {
        toast.success(t('activated'))
        router.refresh()
      } else {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
      }
    })
  }

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeEnrollmentAction({ id: enrollmentId })
      if (result === 'OK') {
        toast.success(t('completed'))
        router.refresh()
      } else {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
      }
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelEnrollmentAction(enrollmentId)
      if (result === 'OK') {
        toast.success(t('cancelled'))
        router.refresh()
      } else {
        toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
      }
    })
  }

  return (
    <div className="flex gap-2">
      {status === 'PENDING' && (
        <>
          <Button size="sm" disabled={isPending} onClick={handleActivate}>
            {isPending ? '...' : t('activate')}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
            {isPending ? '...' : t('cancel')}
          </Button>
        </>
      )}
      {status === 'ACTIVE' && (
        <>
          <Button size="sm" disabled={isPending} onClick={handleComplete}>
            {isPending ? '...' : t('complete')}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
            {isPending ? '...' : t('cancel')}
          </Button>
        </>
      )}
    </div>
  )
}
