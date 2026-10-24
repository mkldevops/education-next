import { getTranslations } from 'next-intl/server'
import type { FamilyDetailEnrollment, FamilyDetailPayment } from '../_lib/family-detail'
import { ActivityFeed } from './activity-feed'

type Props = {
  enrollments: FamilyDetailEnrollment[]
  payments: FamilyDetailPayment[]
  locale: string
  currency: string
  paymentsEnabled: boolean
}

export async function ActivityTab({
  enrollments,
  payments,
  locale,
  currency,
  paymentsEnabled,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="space-y-6">
      {enrollments.length > 0 ? (
        <ActivityFeed
          enrollments={enrollments}
          payments={payments}
          locale={locale}
          currency={currency}
          paymentsEnabled={paymentsEnabled}
        />
      ) : (
        <p className="text-sm text-graphite-600 text-center py-8">{t('sections.noActivity')}</p>
      )}
    </div>
  )
}
