import { ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import type { MealServiceDues } from '@/use-cases/meals/meal-debtors'
import type { PaymentStats } from '@/use-cases/payments/payment-stats'
import { RemainingHorizonSwitch } from './remaining-horizon-switch'

interface Props {
  payments: Pick<PaymentStats, 'totals' | 'tracking'> | null
  meals: { services: MealServiceDues[]; dueAmount: number } | null
  locale: string
  currency: string
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function share(part: number, whole: number) {
  return whole > 0 ? `${(part / whole) * 100}%` : '0%'
}

export async function CollectionOverview({ payments, meals, locale, currency }: Props) {
  const t = await getTranslations('dashboard.home.collection')
  const tServices = await getTranslations('dashboard.pages.meals.services')
  const money = (amount: number) => formatCurrency(amount, locale, currency)

  const totals = payments?.totals ?? null
  const tracking = payments?.tracking ?? null
  const mealLeft = meals?.dueAmount ?? 0
  const collected = totals?.collected ?? 0
  const overdue = tracking?.tracked ? tracking.overdueAmount : 0

  const mealRows = (meals?.services ?? []).map((entry) => ({
    key: entry.service,
    href: '/dashboard/cashier/debtors',
    tone: entry.dueAmount > 0 ? 'bg-danger' : 'bg-success',
    label: tServices(entry.service),
    amount: entry.dueAmount,
    hint: t('mealHint', { upToDate: entry.upToDate, subscribed: entry.subscribed }),
    progress: entry.subscribed > 0 ? (entry.upToDate / entry.subscribed) * 100 : 100,
  }))

  const yearTuition = totals?.remaining ?? 0
  const year: View = {
    outstandingLabel: t('outstandingYear'),
    tuitionLeft: yearTuition,
    collected: totals ? collected : null,
    rows: [
      ...(totals
        ? [
            {
              key: 'tuition',
              href: '/dashboard/payments?horizon=year',
              tone: yearTuition > 0 ? 'bg-warning' : 'bg-success',
              label: t('tuition'),
              amount: yearTuition,
              hint: t('tuitionHint', {
                rate: Math.round(totals.collectionRate),
                count: totals.outstandingCount,
              }),
              progress: totals.collectionRate,
            },
          ]
        : []),
      ...mealRows,
    ],
  }

  const content = (view: View) => (
    <CollectionGrid
      view={view}
      mealLeft={mealLeft}
      overdue={overdue}
      hasTuition={!!totals}
      hasMeals={!!meals}
      money={money}
      t={t}
    />
  )

  if (!tracking?.tracked) {
    return (
      <CollectionSection title={t('title')}>
        {content({ ...year, outstandingLabel: t('outstanding') })}
      </CollectionSection>
    )
  }

  const monthTuition = tracking.dueThisMonth
  const month: View = {
    outstandingLabel: t('outstandingMonth'),
    tuitionLeft: monthTuition,
    collected: null,
    rows: [
      {
        key: 'tuition',
        href: '/dashboard/payments?horizon=month',
        tone: monthTuition > 0 ? 'bg-warning' : 'bg-success',
        label: t('tuition'),
        amount: monthTuition,
        hint: t('tuitionMonthHint', {
          upToDate: tracking.trackedCount - tracking.dueThisMonthCount,
          tracked: tracking.trackedCount,
        }),
        progress:
          tracking.trackedCount > 0
            ? ((tracking.trackedCount - tracking.dueThisMonthCount) / tracking.trackedCount) * 100
            : 100,
      },
      ...mealRows,
    ],
  }

  return <CollectionSection title={t('title')} month={content(month)} year={content(year)} />
}

type Row = {
  key: string
  href: string
  tone: string
  label: string
  amount: number
  hint: string
  progress: number
}

type View = {
  outstandingLabel: string
  tuitionLeft: number
  collected: number | null
  rows: Row[]
}

type Translate = Awaited<ReturnType<typeof getTranslations<'dashboard.home.collection'>>>

function CollectionSection({
  title,
  children,
  month,
  year,
}: {
  title: string
  children?: ReactNode
  month?: ReactNode
  year?: ReactNode
}) {
  const heading = (
    <h2
      id="collection-heading"
      className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
    >
      {title}
    </h2>
  )
  return (
    <section
      aria-labelledby="collection-heading"
      className="home-rise overflow-hidden rounded-xl border border-border bg-surface shadow-xs"
    >
      {month && year ? (
        <RemainingHorizonSwitch
          heading={heading}
          month={month}
          year={year}
          headerClassName="px-5 pt-5 sm:px-6 sm:pt-6"
        />
      ) : (
        <>
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">{heading}</div>
          {children}
        </>
      )}
    </section>
  )
}

function CollectionGrid({
  view,
  mealLeft,
  overdue,
  hasTuition,
  hasMeals,
  money,
  t,
}: {
  view: View
  mealLeft: number
  overdue: number
  hasTuition: boolean
  hasMeals: boolean
  money: (amount: number) => string
  t: Translate
}) {
  const collected = view.collected ?? 0
  const outstanding = view.tuitionLeft + mealLeft
  const scale = collected + outstanding

  return (
    <div className="grid lg:grid-cols-5">
      <div className="flex flex-col gap-5 border-b border-border p-5 sm:p-6 lg:col-span-3 lg:border-r lg:border-b-0">
        <div>
          <p className="text-sm text-muted-foreground">{view.outstandingLabel}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
            {money(outstanding)}
          </p>
          {overdue > 0 && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-danger-subtle px-2.5 py-1 text-xs font-medium text-danger">
              {t('overdue', { amount: money(overdue) })}
            </p>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={t('barLabel', {
              collected: money(collected),
              outstanding: money(outstanding),
            })}
          >
            <span className="home-grow bg-primary" style={{ width: share(collected, scale) }} />
            <span
              className="home-grow bg-warning"
              style={{ width: share(view.tuitionLeft, scale) }}
            />
            <span className="home-grow bg-danger" style={{ width: share(mealLeft, scale) }} />
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {view.collected !== null && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                {t('legendCollected', { amount: money(collected) })}
              </li>
            )}
            {hasTuition && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
                {t('legendTuition')}
              </li>
            )}
            {hasMeals && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-danger" />
                {t('legendMeals')}
              </li>
            )}
          </ul>
        </div>
      </div>

      <ul className="divide-y divide-border lg:col-span-2">
        {view.rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className={cn(
                'group flex items-center gap-4 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-surface-2 sm:px-6',
                focusRing
              )}
            >
              <span aria-hidden="true" className={cn('h-10 w-1 shrink-0 rounded-full', row.tone)} />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                  <span className="shrink-0 text-base font-semibold text-foreground tabular-nums">
                    {money(row.amount)}
                  </span>
                </span>
                <span className="block h-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="home-grow block h-1 rounded-full bg-success"
                    style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }}
                  />
                </span>
                <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>
              </span>
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
