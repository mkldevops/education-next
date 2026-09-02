import { getTranslations } from 'next-intl/server'
import type { Family } from '@/generated/prisma/client'
import { ActionMenu } from './action-menu'

type Props = {
  family: Family
  membersCount: number
  studentsCount: number
  enrollmentsCount: number
  remainingBalance?: number
  payableBalance?: number
  showActions?: boolean
  children?: React.ReactNode
}

export async function HeroBanner({
  family,
  membersCount,
  studentsCount,
  enrollmentsCount,
  remainingBalance = 0,
  payableBalance = 0,
  showActions,
  children,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-graphite" title={family.name}>
          {family.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-graphite-600">
          <span>
            {membersCount} {t('hero.members')}
          </span>
          <span>
            {studentsCount} {t('hero.children')}
          </span>
          <span>
            {enrollmentsCount} {t('hero.enrollments')}
          </span>
          <span className="text-graphite-700">{t('scopeAll')}</span>
        </div>
      </div>

      {(showActions || children) && (
        <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
          {showActions && (
            <ActionMenu
              familyId={family.id}
              canEnroll={studentsCount > 0}
              canRecordPayment={payableBalance > 0}
              hasUnpayableBalance={payableBalance <= 0 && remainingBalance > 0}
            />
          )}
          {children}
        </div>
      )}
    </div>
  )
}
