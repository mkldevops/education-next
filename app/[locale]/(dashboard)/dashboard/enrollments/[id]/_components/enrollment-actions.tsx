'use client'

import { Button } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import type { EnrollmentStatus } from '@/generated/prisma/client'
import { useRouter } from '@/i18n/routing'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { toast, toastActionError } from '@/lib/toast'
import {
  activateEnrollmentAction,
  cancelEnrollmentAction,
  completeEnrollmentAction,
} from '../../../../_lib/enrollment-actions'
import { ApplyDiscountDialog } from '../../_components/apply-discount-dialog'
import { ReassignClassDialog } from '../../_components/reassign-class-dialog'
import { SetEnrollmentPlanDialog } from '../../_components/set-enrollment-plan-dialog'

interface Props {
  enrollmentId: string
  status: EnrollmentStatus
  isAdmin: boolean
  currentClassId: string | null
  availableClasses: Array<{ id: string; name: string }>
  currentTotalAmount: number
  paymentsEnabled: boolean
  planName: string
  availablePlans: Array<{ id: string; name: string }>
}

export function EnrollmentActions({
  enrollmentId,
  status,
  isAdmin,
  currentClassId,
  availableClasses,
  currentTotalAmount,
  paymentsEnabled,
  planName,
  availablePlans,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleActivate = () => {
    startTransition(async () => {
      const result = await activateEnrollmentAction({ id: enrollmentId })
      if (result === 'OK') {
        toast.success(t('activated'))
        router.refresh()
      } else {
        toastActionError(t, result)
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
        toastActionError(t, result)
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
        toastActionError(t, result)
      }
    })
  }

  const canAct = status === 'PENDING' || status === 'ACTIVE'
  if (!isAdmin) return null

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'PENDING' && (
        <>
          <Button size="sm" disabled={isPending} onClick={handleActivate}>
            {t('activate')}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
            {t('cancel')}
          </Button>
        </>
      )}
      {status === 'ACTIVE' && (
        <>
          <Button size="sm" disabled={isPending} onClick={handleComplete}>
            {t('complete')}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
            {t('cancel')}
          </Button>
        </>
      )}
      {canAct && (
        <>
          <ReassignClassDialog
            enrollmentId={enrollmentId}
            currentClassId={currentClassId}
            classes={availableClasses}
          />
          {paymentsEnabled && (
            <ApplyDiscountDialog
              enrollmentId={enrollmentId}
              currentTotalAmount={currentTotalAmount}
            />
          )}
          {paymentsEnabled && planName === UNPRICED_PLAN_NAME && availablePlans.length > 0 && (
            <SetEnrollmentPlanDialog enrollmentId={enrollmentId} plans={availablePlans} />
          )}
        </>
      )}
    </div>
  )
}
