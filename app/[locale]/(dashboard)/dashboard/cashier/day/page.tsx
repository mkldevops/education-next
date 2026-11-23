import { Breadcrumbs, Button, buttonVariants, Card, cn, Input } from '@peaklab/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { addUnreceiptedTuition, type CashTotals, visibleCashLines } from '@/domain/cash-day'
import { formatReceiptNumber } from '@/domain/receipt'
import { schoolToday } from '@/domain/school-date'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { receiptHref } from '@/lib/receipt-link'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isCashDayTuitionEnabled } from '@/use-cases/config/is-cash-day-tuition-enabled'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { requireSchoolCashDay } from '../../../_lib/auth-helper'
import { cashierPageMetadata } from '../../../_lib/page-metadata'
import { CashierTabs, loadCashierTabLabels } from '../_components/cashier-tabs'
import { loadCashDay, loadUnreceiptedPayments } from '../_lib/cash-day-data'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ day?: string }>
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

const shiftDay = (day: string, delta: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * 86_400_000).toISOString().slice(0, 10)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.day.title')
}

/**
 * Caisse d'un jour : reçus émis, annulations du jour, net par mode et par poste. L'administration
 * y lit aussi les paiements d'écolage sans reçu, à part : ils n'entrent jamais dans le total.
 */
export default async function CashDayPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { day: requested } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.day')
  const tMethod = await getTranslations('paymentMethod')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId, isAdmin } = await requireSchoolCashDay()

  const [{ currency, timeZone }, mealsEnabled, paymentsEnabled, tuitionFlag] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    isMealsEnabled(schoolId),
    isPaymentsEnabled(schoolId),
    isCashDayTuitionEnabled(schoolId),
  ])
  const tuitionInCash = paymentsEnabled && tuitionFlag
  const today = schoolToday(timeZone)
  const day =
    requested && DAY.test(requested) && !Number.isNaN(Date.parse(requested)) && requested <= today
      ? requested
      : today
  // Hors caisse, les paiements d'écolage sans reçu restent réservés à l'administration ; une
  // école qui les encaisse au guichet les montre à la caisse et les compte dans son total.
  const [receiptCash, unreceipted] = await Promise.all([
    loadCashDay(schoolId, day, timeZone),
    paymentsEnabled && (isAdmin || tuitionInCash)
      ? loadUnreceiptedPayments(schoolId, day, timeZone)
      : null,
  ])
  const cash =
    tuitionInCash && unreceipted
      ? {
          ...receiptCash,
          issued: addUnreceiptedTuition(receiptCash.issued, unreceipted.rows),
          net: addUnreceiptedTuition(receiptCash.net, unreceipted.rows),
        }
      : receiptCash
  const lines = visibleCashLines(mealsEnabled, [cash.issued, cash.cancelled, cash.net])

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
                href={receiptHref(row.id, `/dashboard/cashier/day?day=${day}`)}
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
          // Sans repas, la caisse elle-même reste fermée : pas de lien vers une page 404.
          ...(mealsEnabled ? [{ label: tBreadcrumbs('cashier'), href: '/dashboard/cashier' }] : []),
          { label: t('title') },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <p className="text-sm text-graphite-600">{t('intro')}</p>
      </div>

      {mealsEnabled && <CashierTabs active="day" labels={await loadCashierTabLabels()} />}

      <nav
        className="flex flex-wrap items-center gap-3 rounded-lg border border-alabaster-700 bg-surface p-2"
        aria-label={t('dayNav')}
      >
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/cashier/day?day=${shiftDay(day, -1)}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t('previous')}
          </Link>
          {day < today ? (
            <Link
              href={`/dashboard/cashier/day?day=${shiftDay(day, 1)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-disabled
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50')}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-graphite first-letter:uppercase">
          {label}
          {day === today && (
            <span className="ml-2 rounded bg-alabaster-800 px-2 py-0.5 text-xs font-medium normal-case text-graphite-600">
              {t('today')}
            </span>
          )}
        </p>
        <form className="flex items-center gap-2 sm:ml-auto">
          {day !== today && (
            <Link
              href="/dashboard/cashier/day"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {t('backToToday')}
            </Link>
          )}
          <Input
            type="date"
            name="day"
            defaultValue={day}
            max={today}
            aria-label={t('pickDay')}
            className="h-8 w-auto"
          />
          <Button type="submit" variant="secondary" size="sm">
            {t('show')}
          </Button>
        </form>
      </nav>

      <Card className="space-y-6 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-graphite-600">{t('net')}</p>
          <p className="text-3xl font-bold tabular-nums text-graphite">{money(cash.net.total)}</p>
          <p className="text-xs text-graphite-600">
            {t('counts', { issued: cash.issued.count, cancelled: cash.cancelled.count })}
            {tuitionInCash &&
              unreceipted &&
              ` · ${t('tuitionCount', { count: unreceipted.rows.length })}`}
          </p>
        </div>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-graphite">{t('byMethod')}</h2>
          {methods.length === 0 ? (
            <p className="text-sm text-graphite-600">{t('noMethod')}</p>
          ) : (
            breakdown(
              methods.map((method) => [tMethod(method), (totals) => totals.byMethod[method] ?? 0])
            )
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-graphite">{t('byLine')}</h2>
          {breakdown(lines.map((line) => [t(`lines.${line}`), (totals) => totals.byLine[line]]))}
        </section>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {receipts(t('issuedReceipts'), cash.issuedRows)}
        {receipts(t('cancelledReceipts'), cash.cancelledRows)}
      </div>

      {unreceipted && (
        <Card className="p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-graphite-600">
            {t(tuitionInCash ? 'unreceipted.titleInCash' : 'unreceipted.title')}
          </h2>
          <p className="mt-1 text-xs text-graphite-600">
            {t(tuitionInCash ? 'unreceipted.introInCash' : 'unreceipted.intro')}
          </p>
          {unreceipted.rows.length === 0 ? (
            <p className="mt-2 text-sm text-graphite-600">{t('unreceipted.none')}</p>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-alabaster-700">
                {unreceipted.rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    {isAdmin ? (
                      <Link
                        href={`/dashboard/families/${row.familyId}?tab=payments`}
                        className="text-foreground hover:underline"
                      >
                        {row.family}
                      </Link>
                    ) : (
                      <span className="text-graphite">{row.family}</span>
                    )}
                    <span className="tabular-nums text-graphite">
                      {money(row.amount)} · {tMethod(row.method)}
                      {row.amount < 0 && (
                        <span className="ml-2 text-red-700">{t('unreceipted.refund')}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t pt-2 text-right text-sm font-medium tabular-nums text-graphite">
                {t('unreceipted.total', {
                  count: unreceipted.rows.length,
                  amount: money(unreceipted.total),
                })}
              </p>
              {unreceipted.truncated && (
                <p className="mt-1 text-right text-xs text-red-700">{t('unreceipted.truncated')}</p>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  )
}
