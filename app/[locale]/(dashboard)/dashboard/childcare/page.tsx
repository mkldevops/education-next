import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
  type ChildcareStatus,
  chargeLeft,
  childcareStatus,
  earliestEndMonth,
  formatChildcareMonth,
  monthOfDay,
  summarizeChildcare,
} from '@/domain/childcare'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { schoolToday } from '@/domain/school-date'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { type BoardRow, ChildcareBoard } from './_components/childcare-board'
import { AddChildDialog, BillMonthDialog } from './_components/childcare-dialogs'

const URGENCY: Record<ChildcareStatus, number> = {
  late: 0,
  due: 1,
  new: 2,
  upToDate: 3,
  stopped: 4,
}

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.childcare.title')
}

export default async function ChildcarePage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.childcare')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()
  if (!(await isMealsEnabled(schoolId))) notFound()

  const [{ currency, timeZone }, subscriptions, familyRows] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    childcareGateway.listSubscriptions(schoolId),
    familyGateway.list(schoolId),
  ])

  const currentMonth = monthOfDay(schoolToday(timeZone))
  const money = (value: number) => formatCurrency(value, locale, currency)
  const month = (value: string) => formatChildcareMonth(value, locale)
  const families = familyRows.map((family) => ({ id: family.id, name: family.name }))

  const rows: BoardRow[] = subscriptions
    .map((row) => {
      const debtor = resolveDebtorFamily(row.student.person.families)
      const totals = summarizeChildcare(row.charges)
      const { status, dueMonths } = childcareStatus(row, currentMonth)
      const lastBilled = row.charges.filter((charge) => !charge.cancelled).at(-1)
      return {
        id: row.id,
        studentId: row.student.id,
        name: `${row.student.person.name} ${row.student.person.lastname}`,
        className:
          row.student.enrollments.flatMap((enrollment) =>
            enrollment.classAssignments.map((assignment) => assignment.classPeriod.name)
          )[0] ?? null,
        archived: !row.student.isActive,
        family: debtor ? { id: debtor.familyId, name: debtor.family.name } : null,
        monthlyAmount: row.monthlyAmount,
        monthlyLabel: money(row.monthlyAmount),
        startMonth: row.startMonth,
        endMonth: row.endMonth,
        periodLabel: row.endMonth
          ? t('period.closed', { start: month(row.startMonth), end: month(row.endMonth) })
          : t('period.open', { start: month(row.startMonth) }),
        openingLabel: row.opening
          ? t('opening', { month: month(row.opening.paidThrough), reason: row.opening.reason })
          : null,
        status,
        dueMonths,
        remaining: totals.remaining,
        remainingLabel: money(totals.remaining),
        billed: totals.billed,
        minEndMonth: earliestEndMonth(row.charges, row.startMonth),
        lastBilledLabel: lastBilled ? month(lastBilled.month) : null,
        charges: row.charges
          .map((charge) => {
            const left = chargeLeft(charge)
            return {
              id: charge.id,
              month: charge.month,
              monthLabel: month(charge.month),
              amount: money(charge.amount),
              left: left > 0 ? money(left) : null,
              paid: charge.paid > 0,
              settled: charge.settled,
              cancelled: charge.cancelled,
            }
          })
          .reverse(),
      }
    })
    .sort(
      (a, b) =>
        URGENCY[a.status] - URGENCY[b.status] ||
        b.remaining - a.remaining ||
        a.name.localeCompare(b.name)
    )

  const rates = [...new Set(rows.map((row) => row.monthlyAmount))].sort((a, b) => a - b)
  const active = rows.filter((row) => row.status !== 'stopped')
  const owing = active.filter((row) => row.remaining > 0)
  const remaining = owing.reduce((sum, row) => sum + row.remaining, 0)
  const thisMonth = summarizeChildcare(
    subscriptions.flatMap((row) => row.charges.filter((charge) => charge.month === currentMonth))
  )
  const collected = thisMonth.billed > 0 ? Math.min(1, thisMonth.paid / thisMonth.billed) : 0

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('childcare') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="text-sm text-graphite-600">
            {t('summary', {
              count: active.length,
              remaining: money(remaining),
              owing: owing.length,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddChildDialog rates={rates} families={families} currentMonth={currentMonth} />
          {rows.length > 0 && (
            <BillMonthDialog currentMonth={currentMonth} currentMonthLabel={month(currentMonth)} />
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <Card className="home-rise space-y-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-semibold text-graphite first-letter:uppercase">
              {t('progress.title', { month: month(currentMonth) })}
            </p>
            {thisMonth.billed > 0 ? (
              <p className="text-sm text-graphite-600 tabular-nums">
                {t('progress.amounts', {
                  paid: money(thisMonth.paid),
                  billed: money(thisMonth.billed),
                })}
                <span className="ml-2 font-semibold text-graphite">
                  {Math.round(collected * 100)} %
                </span>
              </p>
            ) : (
              <p className="text-sm text-graphite-600">
                {t('progress.notBilled', { month: month(currentMonth) })}
              </p>
            )}
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-alabaster-700">
            <div
              className="home-grow h-full rounded-full bg-primary"
              style={{ width: `${collected * 100}%` }}
            />
          </div>
          {thisMonth.remaining > 0 && (
            <p className="text-xs text-graphite-600 tabular-nums">
              {t('progress.left', { amount: money(thisMonth.remaining) })}
            </p>
          )}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-graphite-600">{t('empty')}</Card>
      ) : (
        <ChildcareBoard rows={rows} rates={rates} families={families} />
      )}
    </div>
  )
}
