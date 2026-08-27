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
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { EnrollmentStatusBadge, PaymentMethodLabel } from '@/features/enums'
import type { EnrollmentStatus, PaymentMethod } from '@/generated/prisma/client'
import { Link, useRouter } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { toast } from '@/lib/toast'
import {
  activateEnrollmentAction,
  cancelEnrollmentAction,
  completeEnrollmentAction,
} from '../../../_lib/enrollment-actions'
import { ApplyDiscountDialog } from './apply-discount-dialog'
import { ReassignClassDialog } from './reassign-class-dialog'

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
  amount: number | { toNumber?: () => number; toString: () => string }
  method: PaymentMethod
  reference: string | null
  paidAt: Date
  cashedAt: Date | null
}

export interface EnrollmentDrawerData {
  id: string
  status: EnrollmentStatus
  totalAmount: number | { toNumber?: () => number; toString: () => string }
  discount: number | { toNumber?: () => number; toString: () => string }
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
  locale: string
}

export function EnrollmentDrawer({
  enrollment,
  open,
  onOpenChange,
  isAdmin,
  availableClasses,
  locale,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollments.drawer')
  const tActions = useTranslations('dashboard.pages.enrollmentDetails.actions')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!enrollment) return null

  const familyName =
    enrollment.student.person.families.length > 0
      ? enrollment.student.person.families[0].family.name
      : '-'

  const totalPaid = enrollment.payments.reduce((sum, p) => {
    const amount =
      typeof p.amount === 'number'
        ? p.amount
        : p.amount.toNumber
          ? p.amount.toNumber()
          : Number(p.amount.toString())
    return sum + amount
  }, 0)

  const totalAmountNum =
    typeof enrollment.totalAmount === 'number'
      ? enrollment.totalAmount
      : enrollment.totalAmount.toNumber
        ? enrollment.totalAmount.toNumber()
        : Number(enrollment.totalAmount.toString())

  const discountNum =
    typeof enrollment.discount === 'number'
      ? enrollment.discount
      : enrollment.discount.toNumber
        ? enrollment.discount.toNumber()
        : Number(enrollment.discount.toString())

  const remaining = calculateRemainingBalance(totalAmountNum, totalPaid)

  const currentClassId = enrollment.classAssignments.find((a) => !a.endAt)?.classPeriod.id ?? null

  const handleActivate = () => {
    startTransition(async () => {
      const result = await activateEnrollmentAction({ id: enrollment.id })
      if (result === 'OK') {
        toast.success(tActions('activated'))
        router.refresh()
      } else {
        toast.error(
          tActions.has(`errors.${result}`) ? tActions(`errors.${result}`) : tActions('error')
        )
      }
    })
  }

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeEnrollmentAction({ id: enrollment.id })
      if (result === 'OK') {
        toast.success(tActions('completed'))
        router.refresh()
      } else {
        toast.error(
          tActions.has(`errors.${result}`) ? tActions(`errors.${result}`) : tActions('error')
        )
      }
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelEnrollmentAction(enrollment.id)
      if (result === 'OK') {
        toast.success(tActions('cancelled'))
        router.refresh()
        onOpenChange(false)
      } else {
        toast.error(
          tActions.has(`errors.${result}`) ? tActions(`errors.${result}`) : tActions('error')
        )
      }
    })
  }

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
          <div className="space-y-4 rounded border border-gray-200 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-500">{t('plan')}</p>
                <p className="mt-1 text-sm text-gray-900">{enrollment.plan.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('status')}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <EnrollmentStatusBadge status={enrollment.status} />
                  {remaining > 0 && (
                    <BalanceBadge
                      label={t('balanceBadge', { amount: formatCurrency(remaining, locale) })}
                    />
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('family')}</p>
                <p className="mt-1 text-sm text-gray-900">{familyName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('registeredAt')}</p>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
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
                  <ApplyDiscountDialog enrollmentId={enrollment.id} currentDiscount={discountNum} />
                </>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold text-gray-900">{t('pricing')}</h3>
            <div className="space-y-2 rounded border border-gray-200 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('totalAmount')}</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(totalAmountNum, locale)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('discount')}</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(-discountNum, locale)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('totalPaid')}</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(totalPaid, locale)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                <span className="text-gray-900">{t('remaining')}</span>
                <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {formatCurrency(remaining, locale)}
                </span>
              </div>
            </div>
          </div>

          {enrollment.classAssignments.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-gray-900">
                {t('classAssignments')}
              </h3>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-400">
                      <th className="px-3 py-2 text-left">Classe</th>
                      <th className="px-3 py-2 text-left">Niveau</th>
                      <th className="px-3 py-2 text-left">Période</th>
                      <th className="px-3 py-2 text-left">Début</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {enrollment.classAssignments.map((a) => (
                      <tr key={a.id} className="text-sm">
                        <td className="px-3 py-2">{a.classPeriod.name}</td>
                        <td className="px-3 py-2 text-gray-600">{a.classPeriod.level.name}</td>
                        <td className="px-3 py-2 text-gray-600">{a.classPeriod.period.name}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(a.startAt).toLocaleDateString(locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {enrollment.payments.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-gray-900">{t('payments')}</h3>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-400">
                      <th className="px-3 py-2 text-left">Montant</th>
                      <th className="px-3 py-2 text-left">Méthode</th>
                      <th className="px-3 py-2 text-left">Référence</th>
                      <th className="px-3 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {enrollment.payments.map((p) => (
                      <tr key={p.id} className="text-sm">
                        <td className="px-3 py-2 font-medium">
                          {formatCurrency(p.amount, locale)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          <PaymentMethodLabel method={p.method} />
                        </td>
                        <td className="px-3 py-2 text-gray-600">{p.reference ?? '-'}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(p.paidAt).toLocaleDateString(locale)}
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
