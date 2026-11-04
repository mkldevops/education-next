import { Breadcrumbs, Card, cn } from '@peaklab/ui'
import { CircleCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { formatReceiptNumber } from '@/domain/receipt'
import { schoolToday } from '@/domain/school-date'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { listPayableEnrollmentChoices } from '@/use-cases/payments/payable-enrollment-choices'
import { requireSchoolCashier } from '../../_lib/auth-helper'
import { cashierPageMetadata } from '../../_lib/page-metadata'
import { CashierForm } from './_components/cashier-form'
import { CashierSearch } from './_components/cashier-search'
import { loadCashDay } from './_lib/cash-day-data'
import { loadCashierFamily, loadCashierReceipt, searchCashierFamilies } from './_lib/cashier-data'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; familyId?: string; receipt?: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RECENT_COUNT = 5

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.title')
}

export default async function CashierPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { q, familyId, receipt: receiptId } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')
  const tMethods = await getTranslations('dashboard.pages.payments.record.methods')

  const { schoolId, isAdmin } = await requireSchoolCashier()

  const query = q?.trim() ?? ''
  const selectedId = familyId && UUID.test(familyId) ? familyId : null
  const doneId = !selectedId && receiptId && UUID.test(receiptId) ? receiptId : null
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)

  const [results, family, done, cashDay, paymentsEnabled, mealsEnabled] = await Promise.all([
    query.length >= 2 && !selectedId ? searchCashierFamilies(schoolId, query) : null,
    selectedId ? loadCashierFamily(schoolId, selectedId, today) : null,
    doneId ? loadCashierReceipt(schoolId, doneId) : null,
    loadCashDay(schoolId, today, timeZone),
    isPaymentsEnabled(schoolId),
    isMealsEnabled(schoolId),
  ])
  const [tuitionDue, tuitionEnrollments] =
    family && paymentsEnabled
      ? await Promise.all([
          getFamilyBalance(schoolId, family.id).then((balance) => balance.remainingBalance),
          listPayableEnrollmentChoices(schoolId, family.id),
        ])
      : [null, []]

  const money = (value: number) => formatCurrency(value, locale, currency)
  const seen = new Set<string>()
  const recent = [...cashDay.issuedRows]
    .filter((row) => !row.cancelled && row.familyId)
    .reverse()
    .filter((row) => {
      if (!row.familyId || seen.has(row.familyId)) return false
      seen.add(row.familyId)
      return true
    })
    .slice(0, RECENT_COUNT)
  const time = (date: Date) =>
    date.toLocaleTimeString(locale, { timeZone, hour: '2-digit', minute: '2-digit' })

  const tabs = [
    { href: '/dashboard/cashier', label: t('tabs.collect'), active: true },
    { href: '/dashboard/cashier/day', label: t('day.title'), active: false },
    { href: '/dashboard/cashier/debtors', label: t('debtors.title'), active: false },
    ...(mealsEnabled
      ? [{ href: '/dashboard/cashier/staff', label: t('staff.title'), active: false }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('cashier') },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="text-sm text-graphite-600">{t('intro')}</p>
        </div>
        <Link
          href="/dashboard/cashier/day"
          className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-alabaster-700 px-4 py-2 text-sm hover:bg-alabaster-900"
        >
          <span className="text-graphite-600">{t('today', { count: cashDay.net.count })}</span>
          <span className="text-lg font-bold tabular-nums text-graphite">
            {money(cashDay.net.total)}
          </span>
          {(cashDay.net.byMethod.CASH ?? 0) !== 0 && (
            <span className="text-graphite-600">
              {tMethods('CASH')} {money(cashDay.net.byMethod.CASH ?? 0)}
            </span>
          )}
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-alabaster-700">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab.active
                ? 'border-primary text-graphite'
                : 'border-transparent text-graphite-600 hover:text-graphite'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {selectedId && !family && <p className="text-sm text-graphite-600">{t('noFamily')}</p>}

      {family ? (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold text-graphite">{family.name}</h2>
              <Link href="/dashboard/cashier" className="text-sm text-foreground hover:underline">
                {t('changeFamily')}
              </Link>
            </div>
            {isAdmin && (
              <Link
                href={`/dashboard/families/${family.id}`}
                className="text-sm text-foreground hover:underline"
              >
                {t('viewFamily')}
              </Link>
            )}
          </div>
          {family.students.length > 0 && (
            <p className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="text-graphite-600">{t('mealSheets')}</span>
              {family.students.map((student) => (
                <Link
                  key={student.id}
                  href={`/dashboard/cashier/students/${student.id}`}
                  className="text-foreground hover:underline"
                >
                  {student.name}
                </Link>
              ))}
            </p>
          )}
          <CashierForm
            key={family.id}
            familyId={family.id}
            lines={family.lines}
            childcare={family.childcare}
            tuitionDue={tuitionDue}
            tuitionEnrollments={tuitionEnrollments}
            currency={currency}
            locale={locale}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            {done && (
              <div
                role="status"
                className="flex flex-wrap items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4"
              >
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-green-900">
                    {t('done.title', { amount: money(done.total) })}
                  </p>
                  <p className="text-sm text-green-900">
                    {t('done.detail', {
                      family: done.family,
                      method: tMethods(done.method),
                      number: formatReceiptNumber(done.number),
                    })}
                  </p>
                  <p className="text-sm text-graphite-600">{t('done.next')}</p>
                </div>
                <Link
                  href={`/dashboard/cashier/receipts/${done.id}`}
                  className="text-sm font-medium text-foreground underline"
                >
                  {t('done.view')}
                </Link>
              </div>
            )}
            {!done && !query && (
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-graphite">{t('searchPrompt')}</h2>
                <p className="text-sm text-graphite-600">{t('searchHelp')}</p>
              </div>
            )}
            <CashierSearch query={query} results={results} canListFamilies={isAdmin} />
          </div>

          <aside className="space-y-2">
            <h2 className="text-sm font-semibold text-graphite">{t('recent')}</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-graphite-600">{t('recentEmpty')}</p>
            ) : (
              <ul className="divide-y divide-alabaster-700 rounded-lg border border-alabaster-700">
                {recent.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/dashboard/cashier?familyId=${row.familyId}`}
                      className="flex items-baseline justify-between gap-2 px-3 py-2 text-sm hover:bg-alabaster-900"
                    >
                      <span className="min-w-0 truncate font-medium text-graphite">
                        {row.family}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-graphite-600">
                        {time(row.createdAt)} · {money(row.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
