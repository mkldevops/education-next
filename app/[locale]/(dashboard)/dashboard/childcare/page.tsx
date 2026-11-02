import { Breadcrumbs, Button, Card, Input } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { chargeRemaining, formatChildcareMonth, summarizeChildcare } from '@/domain/childcare'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { formatCurrency } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import {
  BillMonthDialog,
  CancelChargeDialog,
  RemoveSubscriptionDialog,
  SubscriptionDialog,
} from './_components/childcare-dialogs'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.childcare.title')
}

export default async function ChildcarePage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { q } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.childcare')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()
  if (!(await isMealsEnabled(schoolId))) notFound()

  const query = q?.trim() ?? ''
  const [{ currency }, subscriptions, results] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    childcareGateway.listSubscriptions(schoolId),
    query.length >= 2 ? childcareGateway.searchStudents(schoolId, query) : null,
  ])

  const money = (value: number) => formatCurrency(value, locale, currency)
  const month = (value: string) => formatChildcareMonth(value, locale)
  const subscribed = new Set(subscriptions.map((row) => row.student.id))
  const rows = subscriptions
    .map((row) => ({
      ...row,
      name: `${row.student.person.name} ${row.student.person.lastname}`,
      family: resolveDebtorFamily(row.student.person.families),
      totals: summarizeChildcare(row.charges),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

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
          <p className="text-sm text-graphite-600">{t('intro')}</p>
        </div>
        {rows.length > 0 && <BillMonthDialog />}
      </div>

      <search>
        <form className="flex max-w-xl gap-2">
          <Input
            name="q"
            defaultValue={query}
            placeholder={t('search')}
            aria-label={t('search')}
            minLength={2}
            required
          />
          <Button type="submit" variant="outline">
            {t('searchSubmit')}
          </Button>
        </form>
      </search>

      {results &&
        (results.length === 0 ? (
          <p className="text-sm text-graphite-600">{t('noResult')}</p>
        ) : (
          <ul className="max-w-xl divide-y divide-alabaster-700 rounded border border-alabaster-700">
            {results.map((student) => {
              const name = `${student.person.name} ${student.person.lastname}`
              const classes = student.enrollments.flatMap((enrollment) =>
                enrollment.classAssignments.map((assignment) => assignment.classPeriod.name)
              )
              return (
                <li key={student.id} className="flex items-center justify-between gap-4 px-4 py-2">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-graphite">{name}</span>
                    <span className="text-xs text-graphite-600">
                      {classes.join(', ') || t('noClass')}
                    </span>
                  </span>
                  {subscribed.has(student.id) ? (
                    <span className="text-xs text-graphite-600">{t('alreadySubscribed')}</span>
                  ) : (
                    <SubscriptionDialog studentId={student.id} studentName={name} />
                  )}
                </li>
              )
            })}
          </ul>
        ))}

      {rows.length === 0 ? (
        <p className="text-sm text-graphite-600">{t('empty')}</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-graphite">
                    {row.name}
                    {!row.student.isActive && ` · ${t('archived')}`}
                  </h2>
                  <p className="text-sm text-graphite-600">
                    {row.family?.family.name ?? t('noFamily')} ·{' '}
                    {t('perMonth', { amount: money(row.monthlyAmount) })} ·{' '}
                    {row.endMonth
                      ? t('period.closed', {
                          start: month(row.startMonth),
                          end: month(row.endMonth),
                        })
                      : t('period.open', { start: month(row.startMonth) })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <SubscriptionDialog
                    studentId={row.student.id}
                    studentName={row.name}
                    subscription={row}
                  />
                  {row.totals.billed === 0 && (
                    <RemoveSubscriptionDialog studentId={row.student.id} />
                  )}
                </div>
              </div>
              <p className="text-sm text-graphite">
                {t('totals', {
                  billed: money(row.totals.billed),
                  paid: money(row.totals.paid),
                  remaining: money(row.totals.remaining),
                })}
              </p>
              {row.charges.length > 0 && (
                <ul className="divide-y divide-alabaster-700 text-sm">
                  {row.charges.map((charge) => (
                    <li key={charge.id} className="flex items-center justify-between gap-4 py-2">
                      <span>{month(charge.month)}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-graphite-600">
                          {charge.cancelled
                            ? t('charge.cancelled')
                            : t('charge.status', {
                                amount: money(charge.amount),
                                remaining: money(chargeRemaining(charge.amount, charge.paid)),
                              })}
                        </span>
                        {!charge.cancelled && charge.paid === 0 && (
                          <CancelChargeDialog chargeId={charge.id} month={month(charge.month)} />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
