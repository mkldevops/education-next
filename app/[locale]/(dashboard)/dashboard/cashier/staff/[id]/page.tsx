import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolToday } from '@/domain/school-date'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { staffMemberGateway } from '@/gateways/staff-member-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { requireSchoolCashier } from '../../../../_lib/auth-helper'
import { cashierPageMetadata } from '../../../../_lib/page-metadata'
import { MealPanel } from '../../../students/[id]/_components/meal-panel'
import { StaffMemberDialog } from '../_components/staff-member-dialog'
import { StaffReceiptForm } from '../_components/staff-receipt-form'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return cashierPageMetadata(locale, 'dashboard.pages.cashier.staff.sheetTitle')
}

/** Fiche cantine d'un membre du personnel : jours, absences et encaissement. */
export default async function CashierStaffMemberPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.cashier.staff')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId, isAdmin } = await requireSchoolCashier()
  if (!UUID.test(id)) notFound()
  if (!(await isMealsEnabled(schoolId))) notFound()

  const member = await staffMemberGateway.find(schoolId, id)
  if (!member) notFound()

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const [selectedPeriodId, accounts] = await Promise.all([
    getSelectedPeriodId(schoolId),
    mealAccountGateway.findStaffAccounts(schoolId, [member.id]),
  ])
  const canteen = accounts.filter((account) => account.service === 'CANTEEN')
  const summary = (
    await mealAccountGateway.transaction((tx) =>
      loadMealAccountSummaries(tx, { schoolId, accounts: canteen, today })
    )
  )
    .values()
    .next().value
  const canCollect = member.isActive && !member.mealExempt && summary && summary.served.length > 0

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('cashier'), href: '/dashboard/cashier' },
          { label: t('title'), href: '/dashboard/cashier/staff' },
          { label: member.name },
        ]}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{member.name}</h1>
          {member.note && <p className="text-sm text-graphite-600">{member.note}</p>}
          {member.mealExempt && <p className="text-sm text-graphite-600">{t('exemptHint')}</p>}
          {!member.isActive && <p className="text-sm text-amber-600">{t('inactiveHint')}</p>}
        </div>
        {isAdmin && <StaffMemberDialog member={member} />}
      </div>
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <MealPanel
          schoolId={schoolId}
          owner={{ staffMemberId: member.id }}
          services={['CANTEEN']}
          exempt={member.mealExempt}
          locale={locale}
          selectedPeriodId={selectedPeriodId}
          canRecordOpening={isAdmin}
        />
        {canCollect && (
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-graphite">{t('collect')}</h2>
            <StaffReceiptForm
              staffMemberId={member.id}
              unitPrice={summary.unitPrice}
              served={summary.served}
              ledger={summary.ledger}
              paidThrough={summary.coverage.paidThrough}
              dueAmount={summary.coverage.dueAmount}
              daysPerWeek={summary.current?.weekdays.length ?? 0}
              currency={currency}
              locale={locale}
            />
          </Card>
        )}
      </div>
    </div>
  )
}
