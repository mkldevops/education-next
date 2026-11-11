'use client'

import { Card, Input } from '@peaklab/ui'
import { ChevronRight, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ChildcareStatus } from '@/domain/childcare'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import {
  AttachFamilyDialog,
  CancelChargeDialog,
  EditSubscriptionDialog,
  type FamilyOption,
  RemoveSubscriptionDialog,
  ResumeSubscriptionDialog,
  StopSubscriptionDialog,
} from './childcare-dialogs'

export type BoardCharge = {
  id: string
  month: string
  monthLabel: string
  amount: string
  left: string | null
  paid: boolean
  settled: boolean
  cancelled: boolean
}

export type BoardRow = {
  id: string
  studentId: string
  name: string
  className: string | null
  archived: boolean
  family: FamilyOption | null
  monthlyAmount: number
  monthlyLabel: string
  startMonth: string
  endMonth: string | null
  periodLabel: string
  openingLabel: string | null
  status: ChildcareStatus
  dueMonths: number
  remaining: number
  remainingLabel: string
  billed: number
  minEndMonth: string
  lastBilledLabel: string | null
  charges: BoardCharge[]
}

type Filter = 'active' | 'owing' | 'upToDate' | 'stopped'

const FILTERS: Filter[] = ['active', 'owing', 'upToDate', 'stopped']

const BADGE_TONE: Record<ChildcareStatus, string> = {
  late: 'border-red-200 bg-red-50 text-red-800',
  due: 'border-sky-200 bg-sky-50 text-sky-800',
  upToDate: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  new: 'border-alabaster-500 bg-alabaster-900 text-graphite-600',
  stopped: 'border-alabaster-500 bg-alabaster-900 text-graphite-600',
}

const GRID = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_1rem]'

function matchesFilter(row: BoardRow, filter: Filter) {
  if (filter === 'stopped') return row.status === 'stopped'
  if (row.status === 'stopped') return false
  if (filter === 'owing') return row.remaining > 0
  if (filter === 'upToDate') return row.status === 'upToDate'
  return true
}

export function ChildcareBoard({
  rows,
  rates,
  families,
}: {
  rows: BoardRow[]
  rates: number[]
  families: FamilyOption[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase()
  const visible = rows.filter(
    (row) =>
      matchesFilter(row, filter) &&
      (needle === '' ||
        row.name.toLocaleLowerCase().includes(needle) ||
        (row.family?.name.toLocaleLowerCase().includes(needle) ?? false))
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap gap-1 rounded-lg border border-alabaster-700 bg-white p-1">
          <legend className="sr-only">{t('filters.label')}</legend>
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-[background-color,color,transform] duration-200 ease-out active:scale-95',
                filter === key
                  ? 'bg-primary font-semibold text-white shadow-sm'
                  : 'text-graphite-600 hover:bg-alabaster-900'
              )}
            >
              {t(`filters.${key}`)}
              <span className="ml-1.5 tabular-nums opacity-75">
                {rows.filter((row) => matchesFilter(row, key)).length}
              </span>
            </button>
          ))}
        </fieldset>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-graphite-600"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="pl-9"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="home-rise p-6 text-sm text-graphite-600">
          {needle ? t('noMatch', { query: query.trim() }) : t(`emptyFilter.${filter}`)}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div
            className={cn(
              'hidden gap-3 bg-alabaster-900 px-4 py-2 text-xs font-semibold tracking-wide text-graphite-600 uppercase md:grid',
              GRID
            )}
          >
            <span>{t('columns.child')}</span>
            <span className="text-right">{t('columns.rate')}</span>
            <span>{t('columns.status')}</span>
            <span className="text-right">{t('columns.remaining')}</span>
            <span />
          </div>
          <ul key={filter}>
            {visible.map((row, index) => (
              <ChildRow
                key={row.id}
                row={row}
                rates={rates}
                families={families}
                delay={Math.min(index, 12) * 35}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function ChildRow({
  row,
  rates,
  families,
  delay,
}: {
  row: BoardRow
  rates: number[]
  families: FamilyOption[]
  delay: number
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const [open, setOpen] = useState(false)
  const detailId = `childcare-row-${row.id}`
  const badge = {
    late: t('status.late', { count: row.dueMonths }),
    due: t('status.due'),
    upToDate: t('status.upToDate'),
    new: t('status.new'),
    stopped: t('status.stopped'),
  }[row.status]
  const subscription = {
    studentId: row.studentId,
    name: row.name,
    monthlyAmount: row.monthlyAmount,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
  }

  return (
    <li
      className="home-rise border-t border-alabaster-700 first:border-t-0 md:first:border-t"
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={t('toggleChild', { name: row.name })}
        onClick={() => setOpen(!open)}
        className={cn(
          'group grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors duration-200 hover:bg-alabaster-900',
          open && 'bg-alabaster-900',
          GRID,
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-graphite">
            {row.name}
            {row.archived && (
              <span className="ml-2 text-xs font-normal text-graphite-600">{t('archived')}</span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-graphite-600">
            <span className="truncate">{row.className ?? t('noClass')}</span>
            <span aria-hidden="true">·</span>
            {row.family ? (
              <span className="truncate">{row.family.name}</span>
            ) : (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 font-semibold text-amber-900">
                {t('family.none')}
              </span>
            )}
          </span>
        </span>
        <span className="hidden text-right tabular-nums text-graphite md:block">
          {row.monthlyLabel}
        </span>
        <span className="col-start-1 row-start-2 md:col-start-auto md:row-start-auto">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
              BADGE_TONE[row.status]
            )}
          >
            {row.status === 'late' && (
              <span aria-hidden="true" className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-red-600" />
              </span>
            )}
            {badge}
          </span>
        </span>
        <span
          className={cn(
            'col-start-2 row-span-2 row-start-1 text-right font-semibold tabular-nums md:col-start-auto md:row-span-1 md:row-start-auto',
            row.remaining > 0 ? 'text-graphite' : 'text-graphite-600'
          )}
        >
          {row.remainingLabel}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'col-start-3 row-span-2 row-start-1 size-4 text-graphite-600 transition-transform duration-300 ease-out group-hover:translate-x-0.5 md:col-start-auto md:row-span-1 md:row-start-auto',
            open && 'rotate-90 group-hover:translate-x-0'
          )}
        />
      </button>

      <div
        id={detailId}
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-alabaster-700 bg-alabaster-900 px-4 py-3">
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-graphite-600">{t('columns.rate')}</dt>
                <dd className="font-semibold text-graphite tabular-nums">{row.monthlyLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-graphite-600">{t('detail.period')}</dt>
                <dd className="text-graphite">{row.periodLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-graphite-600">{t('detail.family')}</dt>
                <dd className="text-graphite">
                  {row.family ? (
                    <span className="flex flex-wrap gap-x-3">
                      <Link
                        href={`/dashboard/families/${row.family.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {row.family.name}
                      </Link>
                      {row.remaining > 0 && (
                        <Link
                          href={`/dashboard/cashier?familyId=${row.family.id}`}
                          className="text-primary hover:underline"
                        >
                          {t('detail.cashier')}
                        </Link>
                      )}
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-amber-900">{t('family.none')}</span>
                      <AttachFamilyDialog
                        studentId={row.studentId}
                        name={row.name}
                        families={families}
                      />
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {row.openingLabel && <p className="text-xs text-graphite-600">{row.openingLabel}</p>}

            <div className="flex flex-wrap gap-2">
              <EditSubscriptionDialog subscription={subscription} rates={rates} />
              {row.status === 'stopped' || row.endMonth ? (
                <ResumeSubscriptionDialog subscription={subscription} />
              ) : (
                <StopSubscriptionDialog
                  subscription={subscription}
                  earliestEnd={row.minEndMonth}
                  lastBilledLabel={row.lastBilledLabel}
                  remaining={row.remaining > 0 ? row.remainingLabel : null}
                />
              )}
              {row.billed === 0 && <RemoveSubscriptionDialog studentId={row.studentId} />}
            </div>

            {row.charges.length === 0 ? (
              <p className="text-sm text-graphite-600">{t('detail.noCharge')}</p>
            ) : (
              <ul className="divide-y divide-alabaster-700 border-t border-alabaster-700 text-sm">
                {row.charges.map((charge) => (
                  <li
                    key={charge.id}
                    className="flex min-h-10 items-center justify-between gap-3 py-1"
                  >
                    <span className="capitalize">{charge.monthLabel}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-graphite-600">{charge.amount}</span>
                      <ChargeBadge charge={charge} />
                      {!charge.cancelled && !charge.paid && (
                        <CancelChargeDialog chargeId={charge.id} month={charge.monthLabel} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

function ChargeBadge({ charge }: { charge: BoardCharge }) {
  const t = useTranslations('dashboard.pages.childcare')
  const [tone, label] = charge.cancelled
    ? ['border-alabaster-500 bg-alabaster-900 text-graphite-600', t('charge.cancelled')]
    : charge.settled
      ? ['border-emerald-200 bg-emerald-50 text-emerald-800', t('charge.settled')]
      : charge.left
        ? ['border-sky-200 bg-sky-50 text-sky-800', t('charge.due', { amount: charge.left })]
        : ['border-emerald-200 bg-emerald-50 text-emerald-800', t('charge.paid')]
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone
      )}
    >
      {label}
    </span>
  )
}
