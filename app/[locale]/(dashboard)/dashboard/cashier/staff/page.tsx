import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolToday } from '@/domain/school-date'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { requireSchoolCashier } from '../../../_lib/auth-helper'
import { cashierPageMetadata } from '../../../_lib/page-metadata'
import { MealDialog } from '../../students/[id]/_components/meal-dialogs'
import { loadStaffRows } from '../_lib/staff-data'
import { StaffCollectDialog } from './_components/staff-collect-dialog'
import { StaffRowActions } from './_components/staff-row-actions'
import { StaffToday } from './_components/staff-today'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.staff.title')
}

/**
 * Cantine du personnel : les enseignants de l'école, jours de cantine, payé jusqu'au et repas du jour.
 * Les exemptés sont comptés sans jamais être facturés.
 */
export default async function CashierStaffPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.staff')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')
  const tWeekdays = await getTranslations('dashboard.pages.meals.weekdays')

  const { schoolId, isAdmin } = await requireSchoolCashier()
  if (!(await isMealsEnabled(schoolId))) notFound()

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const [rows, setting, selectedPeriodId] = await Promise.all([
    loadStaffRows(schoolId, today),
    mealAccountGateway.findSetting(schoolId, 'CANTEEN'),
    getSelectedPeriodId(schoolId),
  ])
  const periodDates = selectedPeriodId
    ? await mealAccountGateway.findPeriod(schoolId, selectedPeriodId)
    : null
  const period = periodDates && selectedPeriodId ? { id: selectedPeriodId, ...periodDates } : null
  const canteenEnabled = setting?.isEnabled ?? false
  const allowedWeekdays = setting?.allowedWeekdays ?? []
  const active = rows.filter((row) => row.isActive)
  const subscribed = active.filter((row) => row.weekdays.length > 0)
  const todayMembers = active.flatMap((row) =>
    row.today ? [{ id: row.id, name: row.name, mealExempt: row.mealExempt, today: row.today }] : []
  )
  const eatsToday = todayMembers.filter((member) => member.today === 'eats').length
  const totalDue = active.reduce((sum, row) => sum + row.dueAmount, 0)
  const todayLabel = new Date(`${today}T00:00:00.000Z`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })

  const counts = [
    { key: 'subscribed', value: subscribed.length },
    { key: 'exempt', value: subscribed.filter((row) => row.mealExempt).length },
    { key: 'due', value: formatCurrency(totalDue, locale, currency) },
  ] as const

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('cashier'), href: '/dashboard/cashier' },
          { label: t('title') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="text-sm text-graphite-600">{t('intro')}</p>
        </div>
      </div>

      <dl className="grid max-w-2xl grid-cols-3 gap-3">
        {counts.map(({ key, value }) => (
          <Card key={key} className="p-4">
            <dt className="text-xs text-graphite-600">{t(`counts.${key}`)}</dt>
            <dd className="text-2xl font-semibold text-graphite">{value}</dd>
          </Card>
        ))}
      </dl>

      {!canteenEnabled && (
        <p className="max-w-3xl rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('canteenClosed')}{' '}
          <Link href="/dashboard/meals" className="font-medium underline">
            {t('canteenSettings')}
          </Link>
        </p>
      )}
      {canteenEnabled && !period && (
        <p className="max-w-3xl rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('selectPeriod')}
        </p>
      )}

      {todayMembers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-graphite">
            {t('todayTitle', { date: todayLabel, count: eatsToday })}
          </h2>
          <StaffToday members={todayMembers} today={today} />
        </section>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-graphite-600">{t('empty')}</p>
      ) : (
        <section className="space-y-2">
          {todayMembers.length > 0 && (
            <h2 className="text-base font-semibold text-graphite">{t('allStaff')}</h2>
          )}
          <ul className="max-w-3xl divide-y divide-alabaster-700 rounded border border-alabaster-700">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <Link
                    href={`/dashboard/cashier/staff/${row.id}`}
                    className="text-sm font-medium text-graphite hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.mealExempt && (
                    <span className="ml-2 rounded bg-alabaster-900 px-1.5 py-0.5 text-xs text-graphite-600">
                      {t('exemptBadge')}
                    </span>
                  )}
                  {!row.isActive && (
                    <span className="ml-2 rounded bg-alabaster-900 px-1.5 py-0.5 text-xs text-graphite-600">
                      {t('inactiveBadge')}
                    </span>
                  )}
                  <p className="text-xs text-graphite-600">
                    {row.weekdays.length > 0
                      ? row.weekdays.map((day) => tWeekdays(String(day))).join(', ')
                      : t('noCanteen')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right text-xs">
                  {row.weekdays.length > 0 && !row.mealExempt && (
                    <span className="text-graphite-600">
                      {row.paidThrough
                        ? t('paidThrough', { date: formatDay(row.paidThrough) })
                        : t('nothingPaid')}
                      {row.dueDays > 0 && (
                        <span className="block text-amber-600">
                          {t('due', {
                            days: row.dueDays,
                            amount: formatCurrency(row.dueAmount, locale, currency),
                          })}
                        </span>
                      )}
                    </span>
                  )}
                  {row.isActive && row.weekdays.length === 0 && canteenEnabled && period && (
                    <MealDialog
                      kind="subscribe"
                      owner={{ teacherId: row.id }}
                      service="CANTEEN"
                      allowedWeekdays={allowedWeekdays}
                      weekdays={[]}
                      today={today}
                      period={period}
                      triggerVariant="outline"
                    />
                  )}
                  {row.isActive && !row.mealExempt && row.receipt && (
                    <StaffCollectDialog
                      member={row}
                      receipt={row.receipt}
                      highlight={row.dueDays > 0}
                      currency={currency}
                      locale={locale}
                    />
                  )}
                  {row.isActive && (
                    <StaffRowActions
                      member={row}
                      allowedWeekdays={allowedWeekdays}
                      canteenEnabled={canteenEnabled}
                      today={today}
                      isAdmin={isAdmin}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
