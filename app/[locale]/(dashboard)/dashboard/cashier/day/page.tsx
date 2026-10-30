import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { CashLine, CashTotals } from '@/domain/cash-day'
import { formatReceiptNumber } from '@/domain/receipt'
import { schoolToday } from '@/domain/school-date'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { requireSchoolCashier } from '../../../_lib/auth-helper'
import { cashierPageMetadata } from '../../../_lib/page-metadata'
import { loadCashDay } from '../_lib/cash-day-data'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ day?: string }>
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const LINES: CashLine[] = ['CANTEEN', 'SNACK', 'TUITION']

const shiftDay = (day: string, delta: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * 86_400_000).toISOString().slice(0, 10)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.day.title')
}

/** Caisse d'un jour : reçus émis, annulations du jour, net par mode et par poste. */
export default async function CashDayPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { day: requested } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.day')
  const tMethod = await getTranslations('paymentMethod')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolCashier()

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const day =
    requested && DAY.test(requested) && !Number.isNaN(Date.parse(requested)) && requested <= today
      ? requested
      : today
  const cash = await loadCashDay(schoolId, day, timeZone)

  const money = (value: number) => formatCurrency(value, locale, currency)
  const methods = [
    ...new Set([...Object.keys(cash.issued.byMethod), ...Object.keys(cash.cancelled.byMethod)]),
  ].sort()
  const columns: Array<[string, CashTotals]> = [
    [t('issued'), cash.issued],
    [t('cancelled'), cash.cancelled],
    [t('net'), cash.net],
  ]
  const label = new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const breakdown = (rows: Array<[string, (totals: CashTotals) => number]>) => (
    <table className="w-full">
      <thead>
        <tr className="border-b text-xs font-medium uppercase tracking-wider text-graphite-600">
          <th className="pb-2 text-left" />
          {columns.map(([heading]) => (
            <th key={heading} className="pb-2 text-right">
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map(([name, pick]) => (
          <tr key={name} className="text-sm">
            <td className="py-2 pr-4 text-graphite">{name}</td>
            {columns.map(([heading, totals]) => (
              <td key={heading} className="py-2 text-right tabular-nums text-graphite">
                {money(pick(totals))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const receipts = (title: string, rows: typeof cash.issuedRows) => (
    <Card className="p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-graphite-600">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-graphite-600">{t('none')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-alabaster-700">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <Link
                href={`/dashboard/cashier/receipts/${row.id}`}
                className="text-foreground hover:underline"
              >
                {t('receipt', { number: formatReceiptNumber(row.number), family: row.family })}
              </Link>
              <span className="tabular-nums text-graphite">
                {money(row.total)} · {tMethod(row.method)}
                {row.cancelled && <span className="ml-2 text-red-700">{t('cancelledBadge')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

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
        <p className="text-sm text-graphite-600">{t('intro')}</p>
      </div>

      <nav className="flex items-center gap-4 text-sm" aria-label={t('title')}>
        <Link
          href={`/dashboard/cashier/day?day=${shiftDay(day, -1)}`}
          className="text-foreground hover:underline"
        >
          {t('previous')}
        </Link>
        <span className="font-medium capitalize text-graphite">{label}</span>
        {day < today && (
          <Link
            href={`/dashboard/cashier/day?day=${shiftDay(day, 1)}`}
            className="text-foreground hover:underline"
          >
            {t('next')}
          </Link>
        )}
      </nav>

      <Card className="max-w-3xl space-y-6 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-graphite-600">{t('net')}</p>
          <p className="text-3xl font-bold tabular-nums text-graphite">{money(cash.net.total)}</p>
          <p className="text-xs text-graphite-600">
            {t('counts', { issued: cash.issued.count, cancelled: cash.cancelled.count })}
          </p>
        </div>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-graphite">{t('byMethod')}</h2>
          {breakdown(
            methods.map((method) => [tMethod(method), (totals) => totals.byMethod[method] ?? 0])
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-graphite">{t('byLine')}</h2>
          {breakdown(LINES.map((line) => [t(`lines.${line}`), (totals) => totals.byLine[line]]))}
        </section>
      </Card>

      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        {receipts(t('issuedReceipts'), cash.issuedRows)}
        {receipts(t('cancelledReceipts'), cash.cancelledRows)}
      </div>
    </div>
  )
}
