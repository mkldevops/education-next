import { Breadcrumbs, Button, Card, Input } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolToday } from '@/domain/school-date'
import { Link } from '@/i18n/routing'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { requireSchoolCashier } from '../../_lib/auth-helper'
import { cashierPageMetadata } from '../../_lib/page-metadata'
import { CashierForm } from './_components/cashier-form'
import { loadCashierFamily, searchCashierFamilies } from './_lib/cashier-data'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; familyId?: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.title')
}

export default async function CashierPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { q, familyId } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId, isAdmin } = await requireSchoolCashier()

  const query = q?.trim() ?? ''
  const selectedId = familyId && UUID.test(familyId) ? familyId : null
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)

  const [results, family, paymentsEnabled] = await Promise.all([
    query.length >= 2 && !selectedId ? searchCashierFamilies(schoolId, query) : null,
    selectedId ? loadCashierFamily(schoolId, selectedId, today) : null,
    isPaymentsEnabled(schoolId),
  ])
  const tuitionDue =
    family && paymentsEnabled
      ? (await getFamilyBalance(schoolId, family.id)).remainingBalance
      : null

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('cashier') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="text-sm text-graphite-600">{t('intro')}</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard/cashier/day" className="text-foreground hover:underline">
            {t('day.title')}
          </Link>
          <Link href="/dashboard/cashier/debtors" className="text-foreground hover:underline">
            {t('debtors.title')}
          </Link>
        </nav>
      </div>

      <search>
        <form className="flex max-w-xl gap-2">
          <Input
            name="q"
            defaultValue={selectedId ? '' : query}
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
            {results.map((result) => (
              <li key={result.id}>
                <Link
                  href={`/dashboard/cashier?familyId=${result.id}`}
                  className="flex flex-col px-4 py-2 hover:bg-alabaster-900"
                >
                  <span className="text-sm font-medium text-graphite">{result.name}</span>
                  {result.children.length > 0 && (
                    <span className="text-xs text-graphite-600">{result.children.join(', ')}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {selectedId && !family && <p className="text-sm text-graphite-600">{t('noFamily')}</p>}

      {family && (
        <Card className="max-w-3xl p-4">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-graphite">{family.name}</h2>
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
            currency={currency}
            locale={locale}
          />
        </Card>
      )}
    </div>
  )
}
