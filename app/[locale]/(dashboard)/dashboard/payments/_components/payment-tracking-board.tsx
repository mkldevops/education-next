'use client'

import { Card, Input } from '@peaklab/ui'
import { ChevronRight, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { paymentTrackingState } from '@/domain/payment-tracking-state'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import { PAYMENT_TRACKING_BADGE_TONE } from '../../_components/payment-tracking-tone'
import { type Horizon, useUrlHorizon } from '../../_components/remaining-horizon-switch'
import { YearProgress } from '../../_components/year-progress'
import { OutstandingFamilyActions } from './outstanding-family-actions'
import {
  type BoardFamily,
  type GroupKey,
  groupFamilies,
  type TrackingFamily,
} from './payment-tracking-groups'

const PAGE_SIZE = 10

const GROUP_TONE: Record<GroupKey, string> = {
  late: 'border-l-red-600',
  due: 'border-l-sky-600',
  clear: 'border-l-emerald-600',
  remaining: 'border-l-sky-600',
  settled: 'border-l-emerald-600',
}

interface Props {
  families: TrackingFamily[]
  locale: string
  currency: string
  canOpenCashier?: boolean
}

export function PaymentTrackingBoard({
  families,
  locale,
  currency,
  canOpenCashier = false,
}: Props) {
  const t = useTranslations('dashboard.pages.payments.tracking')
  const [horizon] = useUrlHorizon()
  const [query, setQuery] = useState('')
  const money = (amount: number) => formatCurrency(amount, locale, currency)

  const { groups, scopeCount } = groupFamilies(families, horizon, query)
  const searching = query.trim().length > 0
  const matches = groups.reduce((sum, group) => sum + group.families.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {scopeCount === 0 ? (
        <Card className="p-6 text-sm text-graphite-600">{t('noTracking')}</Card>
      ) : searching && matches === 0 ? (
        <Card className="p-6 text-sm text-graphite-600">
          {t('noMatch', { query: query.trim() })}
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) =>
            searching && group.families.length === 0 ? null : (
              <TrackingGroup
                key={`${horizon}-${group.key}-${searching}`}
                groupKey={group.key}
                families={group.families}
                amount={group.amount}
                horizon={horizon}
                defaultOpen={searching || group.key === 'late'}
                money={money}
                currency={currency}
                canOpenCashier={canOpenCashier}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function TrackingGroup({
  groupKey,
  families,
  amount,
  horizon,
  defaultOpen,
  money,
  currency,
  canOpenCashier,
}: {
  groupKey: GroupKey
  families: BoardFamily[]
  amount: number
  horizon: Horizon
  defaultOpen: boolean
  money: (amount: number) => string
  currency: string
  canOpenCashier: boolean
}) {
  const t = useTranslations('dashboard.pages.payments.tracking')
  const [open, setOpen] = useState(defaultOpen)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const panelId = `tracking-group-${groupKey}`
  const hidden = families.length - visible

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between gap-3 border-l-4 px-4 py-3 text-left hover:bg-alabaster-900',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          GROUP_TONE[groupKey]
        )}
      >
        <span className="font-semibold text-graphite">
          {t(`groups.${groupKey}`)}
          <span className="ml-2 text-sm font-normal text-graphite-600">
            {t('familyCount', { count: families.length })}
          </span>
        </span>
        <span className="flex items-center gap-2 font-semibold tabular-nums text-graphite">
          {money(amount)}
          <ChevronRight
            aria-hidden="true"
            className={cn('size-4 text-graphite-600 transition-transform', open && 'rotate-90')}
          />
        </span>
      </button>

      {open && (
        <div id={panelId}>
          {families.length === 0 ? (
            <p className="border-t border-alabaster-700 px-4 py-3 text-sm text-graphite-600">
              {t('empty')}
            </p>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_1rem] gap-3 border-t border-alabaster-700 bg-alabaster-900 px-4 py-2 text-xs font-semibold tracking-wide text-graphite-600 uppercase md:grid">
                <span>{t('columns.family')}</span>
                <span>{t('columns.status')}</span>
                <span className="text-right">
                  {horizon === 'month' ? t('columns.dueThisMonth') : t('columns.remainingYear')}
                </span>
                <span className="text-right">{t('columns.paid')}</span>
                <span className="text-right">{t('columns.expectedToDate')}</span>
                <span />
              </div>
              <ul>
                {families.slice(0, visible).map((family) => (
                  <FamilyRow
                    key={family.familyId}
                    family={family}
                    money={money}
                    currency={currency}
                    canOpenCashier={canOpenCashier}
                  />
                ))}
              </ul>
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setVisible(visible + PAGE_SIZE * 5)}
                  className="w-full border-t border-alabaster-700 px-4 py-2 text-sm text-graphite-600 hover:bg-alabaster-900 hover:text-graphite"
                >
                  {t('showMore', { count: hidden })}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function FamilyRow({
  family,
  money,
  currency,
  canOpenCashier,
}: {
  family: BoardFamily
  money: (amount: number) => string
  currency: string
  canOpenCashier: boolean
}) {
  const t = useTranslations('dashboard.pages.payments.tracking')
  const [open, setOpen] = useState(false)
  const state = paymentTrackingState(family)
  const detailId = `tracking-family-${family.familyId}`
  const badge = {
    late: t('status.late', { amount: money(family.overdueAmount) }),
    due: t('status.due'),
    ahead: t('status.ahead', { amount: money(family.advance) }),
    upToDate: t('status.upToDate'),
    settled: t('status.settled'),
    untracked: t('status.untracked'),
  }[state]

  return (
    <li className="border-t border-alabaster-700">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={t('toggleFamily', { family: family.familyName })}
        onClick={() => setOpen(!open)}
        className={cn(
          'grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-alabaster-900',
          'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_1rem]',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
        )}
      >
        <span className="truncate font-semibold text-graphite">{family.familyName}</span>
        <span className="col-start-1 row-start-2 md:col-start-auto md:row-start-auto">
          <span
            className={cn(
              'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
              PAYMENT_TRACKING_BADGE_TONE[state]
            )}
          >
            {badge}
          </span>
        </span>
        <span className="col-start-2 row-span-2 row-start-1 text-right font-semibold tabular-nums text-graphite md:col-start-auto md:row-span-1 md:row-start-auto">
          {money(family.amount)}
        </span>
        <span className="hidden text-right tabular-nums text-graphite md:block">
          {money(family.creditedPaid)}
        </span>
        <span className="hidden text-right tabular-nums text-graphite md:block">
          {family.tracked ? money(family.expectedToDate) : '—'}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'col-start-3 row-span-2 row-start-1 size-4 text-graphite-600 transition-transform md:col-start-auto md:row-span-1 md:row-start-auto',
            open && 'rotate-90'
          )}
        />
      </button>
      {open && (
        <FamilyCard
          id={detailId}
          family={family}
          money={money}
          currency={currency}
          canOpenCashier={canOpenCashier}
        />
      )}
    </li>
  )
}

function FamilyCard({
  id,
  family,
  money,
  currency,
  canOpenCashier,
}: {
  id: string
  family: BoardFamily
  money: (amount: number) => string
  currency: string
  canOpenCashier: boolean
}) {
  const t = useTranslations('dashboard.pages.payments.tracking')
  const tYear = useTranslations('dashboard.pages.familyDetails.paymentTracking')
  const { annualAmount, creditedPaid, expectedToDate, overdueAmount, remainingYear } = family
  const scheduled = family.tracked && remainingYear > 0

  return (
    <div
      id={id}
      className="mx-4 mb-3 space-y-3 rounded-lg border border-alabaster-700 bg-alabaster-900 p-3"
    >
      {annualAmount > 0 && (
        <YearProgress
          t={tYear}
          money={money}
          paid={creditedPaid}
          total={annualAmount}
          overdue={overdueAmount}
          expected={expectedToDate}
          scheduled={scheduled}
          showExpected={scheduled && family.fullyScheduled}
        />
      )}
      {family.amount > 0 && (
        <OutstandingFamilyActions
          family={{ id: family.familyId, name: family.familyName }}
          phone={family.contactPhone}
          overdueAmount={money(family.amount)}
          currency={currency}
          canOpenCashier={canOpenCashier}
        />
      )}
      <Link
        href={`/dashboard/families/${family.familyId}?tab=payments`}
        className="inline-block text-sm font-medium text-foreground underline underline-offset-2"
      >
        {t('openFamily')}
      </Link>
    </div>
  )
}
