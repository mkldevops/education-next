'use client'

import {
  BalanceBadge,
  Button,
  buttonVariants,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  StatusBadge,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { EnrollmentStatusBadge, PaymentMethodLabel } from '@/features/enums'
import type { EnrollmentStatus, PaymentMethod } from '@/generated/prisma/client'
import { Link, useRouter } from '@/i18n/routing'
import { formatDate } from '@/lib/date'
import { type DecimalLike, formatCurrency, toNumber } from '@/lib/decimal'
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

interface ClassAssignment {
  id: string
  startAt: Date
  endAt: Date | null
  classPeriod: {
    id: string
    name: string
    level: { name: string }
    period: { name: string }
  }
}

interface Payment {
  id: string
  amount: DecimalLike
  method: PaymentMethod
  reference: string | null
  paidAt: Date
  cashedAt: Date | null
}

export interface EnrollmentDrawerData {
  id: string
  status: EnrollmentStatus
  totalAmount: DecimalLike
  discount: DecimalLike
  registeredAt: Date
  student: {
    person: {
      name: string
      lastname: string
      families: Array<{ family: { name: string } }>
    }
  }
  plan: { name: string }
  classAssignments: ClassAssignment[]
  payments: Payment[]
}

interface Props {
  enrollment: EnrollmentDrawerData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  availableClasses: Array<{ id: string; name: string }>
  availablePlans: Array<{ id: string; name: string }>
  paymentsEnabled: boolean
  locale: string
}

export function EnrollmentDrawer({
  enrollment,
  open,
  onOpenChange,
  isAdmin,
  availableClasses,
  availablePlans,
  paymentsEnabled,
  locale,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollments.drawer')
  const tEnrollments = useTranslations('dashboard.pages.enrollments')
  const tDetails = useTranslations('dashboard.pages.enrollmentDetails')
  const tActions = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!enrollment) return null

  const familyName =
    enrollment.student.person.families.length > 0
      ? enrollment.student.person.families[0].family.name
      : '-'

  const totalPaid = enrollment.payments.reduce((sum, p) => sum + toNumber(p.amount), 0)
  const totalAmountNum = toNumber(enrollment.totalAmount)
  const discountNum = toNumber(enrollment.discount)

  const remaining = calculateRemainingBalance(totalAmountNum, totalPaid)

  const currentClassId = enrollment.classAssignments.find((a) => !a.endAt)?.classPeriod.id ?? null

  const run = (action: () => Promise<string>, successKey: string, closeAfter = false) => {
    startTransition(async () => {
      const result = await action()
      if (result !== 'OK') {
        toastActionError(tActions, result)
        return
      }
      toast.success(tActions(successKey))
      router.refresh()
      if (closeAfter) onOpenChange(false)
    })
  }

  const handleActivate = () =>
    run(() => activateEnrollmentAction({ id: enrollment.id }), 'activated')
  const handleComplete = () =>
    run(() => completeEnrollmentAction({ id: enrollment.id }), 'completed')
  const handleCancel = () => run(() => cancelEnrollmentAction(enrollment.id), 'cancelled', true)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {enrollment.student.person.name} {enrollment.student.person.lastname}
          </DrawerTitle>
          <DrawerClose label={t('close')} />
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <div className="space-y-4 rounded border border-alabaster-700 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {paymentsEnabled && (
                <div>
                  <p className="text-sm font-medium text-graphite-600">{t('plan')}</p>
                  <p className="mt-1 text-sm text-graphite">
                    {enrollment.plan.name === UNPRICED_PLAN_NAME ? (
                      <StatusBadge status="amber" label={tEnrollments('unpriced.badge')} />
                    ) : (
                      enrollment.plan.name
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-graphite-600">{t('status')}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <EnrollmentStatusBadge status={enrollment.status} />
                  {paymentsEnabled && remaining > 0 && (
                    <BalanceBadge
                      label={t('balanceBadge', { amount: formatCurrency(remaining, locale) })}
                    />
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-graphite-600">{t('family')}</p>
                <p className="mt-1 text-sm text-graphite">{familyName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-graphite-600">{t('registeredAt')}</p>
                <p className="mt-1 text-sm text-graphite">
                  {formatDate(enrollment.registeredAt, locale)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-3">
              {isAdmin && enrollment.status === 'PENDING' && (
                <>
                  <Button size="sm" disabled={isPending} onClick={handleActivate}>
                    {isPending ? '...' : tActions('activate')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
                    {isPending ? '...' : tActions('cancel')}
                  </Button>
                </>
              )}
              {isAdmin && enrollment.status === 'ACTIVE' && (
                <>
                  <Button size="sm" disabled={isPending} onClick={handleComplete}>
                    {isPending ? '...' : tActions('complete')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
                    {isPending ? '...' : tActions('cancel')}
                  </Button>
                </>
              )}
              {isAdmin && (enrollment.status === 'PENDING' || enrollment.status === 'ACTIVE') && (
                <>
                  <ReassignClassDialog
                    enrollmentId={enrollment.id}
                    currentClassId={currentClassId}
                    classes={availableClasses}
                  />
                  {paymentsEnabled && (
                    <ApplyDiscountDialog
                      enrollmentId={enrollment.id}
                      currentDiscount={discountNum}
                    />
                  )}
                  {paymentsEnabled &&
                    enrollment.plan.name === UNPRICED_PLAN_NAME &&
                    availablePlans.length > 0 && (
                      <SetEnrollmentPlanDialog
                        enrollmentId={enrollment.id}
                        plans={availablePlans}
                      />
                    )}
                </>
              )}
            </div>
          </div>

          {paymentsEnabled && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-graphite">{t('pricing')}</h3>
              <div className="space-y-2 rounded border border-alabaster-700 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-graphite-600">{t('totalAmount')}</span>
                  <span className="font-medium text-graphite">
                    {formatCurrency(totalAmountNum, locale)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-graphite-600">{t('discount')}</span>
                  <span className="font-medium text-graphite">
                    {formatCurrency(-discountNum, locale)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-graphite-600">{t('totalPaid')}</span>
                  <span className="font-medium text-graphite">
                    {formatCurrency(totalPaid, locale)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                  <span className="text-graphite">{t('remaining')}</span>
                  <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
                    {formatCurrency(remaining, locale)}
                  </span>
                </div>
              </div>
            </div>
          )}
          {enrollment.classAssignments.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-graphite">
                {t('classAssignments')}
              </h3>
              <div className="overflow-x-auto rounded border border-alabaster-700">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b bg-alabaster-900 text-xs font-medium uppercase tracking-wider text-graphite-600">
                      <th className="px-3 py-2 text-left">
                        {tDetails('classAssignmentTable.class')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {tDetails('classAssignmentTable.level')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {tDetails('classAssignmentTable.period')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {tDetails('classAssignmentTable.startDate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {enrollment.classAssignments.map((a) => (
                      <tr key={a.id} className="text-sm">
                        <td className="px-3 py-2">{a.classPeriod.name}</td>
                        <td className="px-3 py-2 text-graphite-600">{a.classPeriod.level.name}</td>
                        <td className="px-3 py-2 text-graphite-600">{a.classPeriod.period.name}</td>
                        <td className="px-3 py-2 text-graphite-600">
                          {formatDate(a.startAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {paymentsEnabled && enrollment.payments.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-graphite">{t('payments')}</h3>
              <div className="overflow-x-auto rounded border border-alabaster-700">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b bg-alabaster-900 text-xs font-medium uppercase tracking-wider text-graphite-600">
                      <th className="px-3 py-2 text-left">{tDetails('paymentTable.amount')}</th>
                      <th className="px-3 py-2 text-left">{tDetails('paymentTable.method')}</th>
                      <th className="px-3 py-2 text-left">{tDetails('paymentTable.reference')}</th>
                      <th className="px-3 py-2 text-left">{tDetails('paymentTable.paidAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {enrollment.payments.map((p) => (
                      <tr key={p.id} className="text-sm">
                        <td className="px-3 py-2 font-medium">
                          {formatCurrency(p.amount, locale)}
                        </td>
                        <td className="px-3 py-2 text-graphite-600">
                          <PaymentMethodLabel method={p.method} />
                        </td>
                        <td className="px-3 py-2 text-graphite-600">{p.reference ?? '-'}</td>
                        <td className="px-3 py-2 text-graphite-600">
                          {formatDate(p.paidAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Link href={`/dashboard/enrollments/${enrollment.id}`} className={buttonVariants()}>
            {t('openFullPage')}
          </Link>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
