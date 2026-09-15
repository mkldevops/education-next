import { Card } from '@peaklab/ui'
import { BookOpen, CircleCheck, TriangleAlert, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { FamilyPerson, Person, PhoneNumber } from '@/generated/prisma/client'
import { formatCurrency } from '@/lib/decimal'
import { isStripeConfigured } from '@/lib/stripe'
import { FinancialSummary } from './financial-summary'
import { KPICard } from './kpi-card'
import { OnlinePaymentButton } from './online-payment-button'
import { ParentsSection } from './parents-section'

type PersonWithRelation = FamilyPerson & {
  person: Person & {
    phoneNumbers: PhoneNumber[]
  }
}

type Props = {
  locale: string
  familyId: string
  isAdmin: boolean
  persons: PersonWithRelation[]
  linkedEmails: string[]
  enrolledChildren: number
  totalEnrollments: number
  activeEnrollments: number
  paymentsEnabled: boolean
  totalPaid: number
  remainingBalance: number
  totalDue: number
  totalDiscount: number
}

export async function OverviewTab({
  locale,
  familyId,
  isAdmin,
  persons,
  linkedEmails,
  enrolledChildren,
  totalEnrollments,
  activeEnrollments,
  paymentsEnabled,
  totalPaid,
  remainingBalance,
  totalDue,
  totalDiscount,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="space-y-6">
      <div
        className={
          paymentsEnabled
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
            : 'grid grid-cols-1 md:grid-cols-2 gap-4'
        }
      >
        <KPICard label={t('kpis.enrolledChildren')} value={enrolledChildren} icon={Users} />
        <KPICard
          label={t('kpis.totalEnrollments')}
          value={totalEnrollments}
          subValue={`${activeEnrollments} ${t('kpis.active')}`}
          icon={BookOpen}
        />
        {paymentsEnabled && (
          <>
            <KPICard
              label={t('kpis.totalPaid')}
              value={formatCurrency(totalPaid, locale)}
              icon={CircleCheck}
              color="green"
            />
            <KPICard
              label={t('kpis.remainingBalance')}
              value={formatCurrency(remainingBalance, locale)}
              icon={remainingBalance > 0 ? TriangleAlert : CircleCheck}
              color={remainingBalance > 0 ? 'amber' : 'green'}
            />
          </>
        )}
      </div>
      <div
        className={
          paymentsEnabled ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'
        }
      >
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-graphite mb-4">{t('sections.parentsTitle')}</h2>
          <ParentsSection
            persons={persons}
            familyId={familyId}
            isAdmin={isAdmin}
            linkedEmails={linkedEmails}
          />
        </Card>
        {paymentsEnabled && (
          <Card className="p-6">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-graphite">
                {t('sections.financialTitle')}
              </h2>
              <span className="text-xs text-graphite-700">{t('scopeAll')}</span>
            </div>
            <FinancialSummary
              totalDue={totalDue}
              totalPaid={totalPaid}
              totalDiscount={totalDiscount}
              remainingBalance={remainingBalance}
            />
            {!isAdmin && (
              <div className="mt-5 border-t border-alabaster-700 pt-5">
                <OnlinePaymentButton
                  amount={remainingBalance}
                  configured={isStripeConfigured()}
                  locale={locale}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
