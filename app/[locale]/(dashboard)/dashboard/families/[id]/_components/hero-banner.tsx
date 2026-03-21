import type { Family } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { ActionMenu } from './action-menu'

type Props = {
  family: Family
  membersCount: number
  studentsCount: number
  enrollmentsCount: number
  showActions?: boolean
  children?: React.ReactNode
}

export async function HeroBanner({
  family,
  membersCount,
  studentsCount,
  enrollmentsCount,
  showActions,
  children,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
          <span>
            {membersCount} {t('hero.members')}
          </span>
          <span>
            {studentsCount} {t('hero.children')}
          </span>
          <span>
            {enrollmentsCount} {t('hero.enrollments')}
          </span>
        </div>
      </div>

      {(showActions || children) && (
        <div className="flex items-center gap-2">
          {showActions && <ActionMenu familyId={family.id} />}
          {children}
        </div>
      )}
    </div>
  )
}
