import { getTranslations } from 'next-intl/server'
import { languagesOf } from '@/domain/family'
import type { Family } from '@/generated/prisma/client'
import { ActionMenu } from './action-menu'

type Props = {
  family: Family
  membersCount: number
  studentsCount: number
  enrollmentsCount: number
  paymentsEnabled: boolean
  remainingBalance: number
  showActions?: boolean
  children?: React.ReactNode
}

export async function HeroBanner({
  family,
  membersCount,
  studentsCount,
  enrollmentsCount,
  paymentsEnabled,
  remainingBalance,
  showActions,
  children,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')
  const languagesAtHome = languagesOf(family.languagesAtHome)

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
          {languagesAtHome.length > 0 && (
            <span>{t('hero.languagesAtHome', { languages: languagesAtHome.join(', ') })}</span>
          )}
          <span className="text-graphite-700">{t('scopeAll')}</span>
        </div>
      </div>

      {(showActions || children) && (
        <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
          {showActions && (
            <ActionMenu
              familyId={family.id}
              paymentsEnabled={paymentsEnabled}
              canRecordPayment={remainingBalance > 0}
            />
          )}
          {children}
        </div>
      )}
    </div>
  )
}
