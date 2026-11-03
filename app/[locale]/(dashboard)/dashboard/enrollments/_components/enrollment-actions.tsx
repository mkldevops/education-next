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
} from '../../../_lib/enrollment-actions'
import { ApplyDiscountDialog } from './apply-discount-dialog'
import { ReassignClassDialog } from './reassign-class-dialog'
import { SetEnrollmentPlanDialog } from './set-enrollment-plan-dialog'
import { SetStartMonthDialog, type StartMonthSetting } from './set-start-month-dialog'

interface Props {
  enrollmentId: string
  status: EnrollmentStatus
  isAdmin: boolean
  currentClassId: string | null
  availableClasses: Array<{ id: string; name: string }>
  currentTotalAmount: number
  currency: string
  paymentsEnabled: boolean
  planName: string
  availablePlans: Array<{ id: string; name: string }>
  /** Absent: the surface cannot edit the start month. */
  startMonth?: StartMonthSetting
  onCancelled?: () => void
}

export function EnrollmentActions({
  enrollmentId,
  status,
  isAdmin,
  currentClassId,
  availableClasses,
  currentTotalAmount,
  currency,
  paymentsEnabled,
  planName,
  availablePlans,
  startMonth,
  onCancelled,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const run = (action: () => Promise<string>, successKey: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action()
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t(successKey))
      router.refresh()
      onDone?.()
    })

  const handleActivate = () =>
    run(() => activateEnrollmentAction({ id: enrollmentId }), 'activated')
  const handleComplete = () =>
    run(() => completeEnrollmentAction({ id: enrollmentId }), 'completed')
  const handleCancel = () =>
    run(() => cancelEnrollmentAction(enrollmentId), 'cancelled', onCancelled)

  const canAct = status === 'PENDING' || status === 'ACTIVE'
  if (!isAdmin) return null

  return (
    <div className="flex flex-wrap gap-2">
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
              currency={currency}
            />
          )}
          {paymentsEnabled && startMonth && (
            <SetStartMonthDialog enrollmentId={enrollmentId} startMonth={startMonth} />
          )}
          {paymentsEnabled && planName === UNPRICED_PLAN_NAME && availablePlans.length > 0 && (
            <SetEnrollmentPlanDialog enrollmentId={enrollmentId} plans={availablePlans} />
          )}
        </>
      )}
    </div>
  )
}
