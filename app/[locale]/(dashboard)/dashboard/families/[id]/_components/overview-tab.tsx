import { Card } from '@peaklab/ui'
import { BookOpen, CircleCheck, TriangleAlert, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { formatCurrency } from '@/lib/decimal'
import { familyActionHref } from '../_lib/family-action-href'
import type { FamilyDetailStudent } from '../_lib/family-detail'
import { ChildrenSummary } from './children-summary'
import { FinancialSummary } from './financial-summary'
import { KPICard } from './kpi-card'
import { OnlinePaymentButton } from './online-payment-button'
import { ParentsSection, type PersonWithRelation } from './parents-section'

type Props = {
  locale: string
  currency: string
  familyId: string
  isAdmin: boolean
  canInvite: boolean
  persons: PersonWithRelation[]
  students: FamilyDetailStudent[]
  linkedEmails: string[]
  enrolledChildren: number
  totalEnrollments: number
  activeEnrollments: number
  canAddEnrollment: boolean
  paymentsEnabled: boolean
  /** Stripe activé et configuré pour l'école de la famille. */
  onlinePaymentAvailable: boolean
  totalPaid: number
  remainingBalance: number
  totalDue: number
  totalDiscount: number
}

export async function OverviewTab({
  locale,
  currency,
  familyId,
  isAdmin,
  canInvite,
  persons,
  students,
  linkedEmails,
  enrolledChildren,
  totalEnrollments,
  activeEnrollments,
  canAddEnrollment,
  paymentsEnabled,
  onlinePaymentAvailable,
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
          action={
            isAdmin && canAddEnrollment
              ? {
                  href: familyActionHref(familyId, 'addEnrollment'),
                  label: t('actions.addEnrollment'),
                }
              : undefined
          }
        />
        {paymentsEnabled && (
          <>
            <KPICard
              label={t('kpis.totalPaid')}
              value={formatCurrency(totalPaid, locale, currency)}
              icon={CircleCheck}
              color="green"
            />
            <KPICard
              label={t('kpis.remainingBalance')}
              value={formatCurrency(remainingBalance, locale, currency)}
              icon={remainingBalance > 0 ? TriangleAlert : CircleCheck}
              color={remainingBalance > 0 ? 'amber' : 'green'}
            />
          </>
        )}
      </div>
      {/* « Ajouter un élève » ne vit que dans l'en-tête : le répéter ici doublait l'action. */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-graphite">{t('sections.childrenTitle')}</h2>
        <ChildrenSummary
          students={students}
          locale={locale}
          currency={currency}
          paymentsEnabled={paymentsEnabled}
        />
      </Card>
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
            canInvite={canInvite}
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
              currency={currency}
            />
            {!isAdmin && (
              <div className="mt-5 border-t border-alabaster-700 pt-5">
                <OnlinePaymentButton
                  amount={remainingBalance}
                  configured={onlinePaymentAvailable}
                  locale={locale}
                  currency={currency}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
