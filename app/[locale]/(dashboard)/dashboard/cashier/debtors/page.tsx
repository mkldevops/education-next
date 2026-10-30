import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolToday } from '@/domain/school-date'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { requireSchoolCashier } from '../../../_lib/auth-helper'
import { cashierPageMetadata } from '../../../_lib/page-metadata'
import { loadMealDebtors, REMIND_WITHIN_DAYS } from '../_lib/debtors-data'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.debtors.title')
}

/** Impayés et comptes à relancer, avec un lien vers la caisse de la famille redevable. */
export default async function MealDebtorsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.debtors')
  const tServices = await getTranslations('dashboard.pages.meals.services')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolCashier()

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const rows = await loadMealDebtors(schoolId, schoolToday(timeZone))
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })
  const total = rows.reduce((sum, row) => sum + row.dueAmount, 0)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('cashier'), href: '/dashboard/cashier' },
          { label: t('title') },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <p className="text-sm text-graphite-600">{t('intro', { days: REMIND_WITHIN_DAYS })}</p>
      </div>

      <Card className="max-w-4xl p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-graphite-600">{t('empty')}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-graphite">
              {t('total', { count: rows.length, amount: formatCurrency(total, locale, currency) })}
            </p>
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-graphite-600">
                  <th className="pb-2 text-left">{t('student')}</th>
                  <th className="pb-2 text-left">{t('service')}</th>
                  <th className="pb-2 text-left">{t('paidThrough')}</th>
                  <th className="pb-2 text-right">{t('due')}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={`${row.studentId}-${row.service}`} className="text-sm">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/dashboard/cashier/students/${row.studentId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-graphite">{tServices(row.service)}</td>
                    <td className="py-2 pr-4 text-graphite">
                      {row.paidThrough ? formatDay(row.paidThrough) : t('nothingPaid')}
                      {row.dueDays === 0 && (
                        <span className="block text-xs text-amber-700">
                          {t('coveredLeft', { days: row.coveredLeft })}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.dueDays > 0 ? (
                        <span className="text-red-700">
                          {t('dueDetail', {
                            days: row.dueDays,
                            amount: formatCurrency(row.dueAmount, locale, currency),
                          })}
                        </span>
                      ) : (
                        <span className="text-graphite-600">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.familyId && (
                        <Link
                          href={`/dashboard/cashier?familyId=${row.familyId}`}
                          className="text-foreground hover:underline"
                        >
                          {t('collect')}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  )
}
