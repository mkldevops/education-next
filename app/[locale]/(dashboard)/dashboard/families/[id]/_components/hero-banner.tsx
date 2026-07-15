import { getTranslations } from 'next-intl/server'
import type { Family } from '@/generated/prisma/client'
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
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-gray-900" title={family.name}>
          {family.name}
        </h1>
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
        <div className="flex items-center gap-2 self-start md:self-auto">
          {showActions && <ActionMenu familyId={family.id} />}
          {children}
        </div>
      )}
    </div>
  )
}
