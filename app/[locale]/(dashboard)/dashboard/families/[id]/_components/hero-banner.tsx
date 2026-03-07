import type { Family } from '@prisma/client'
import { getTranslations } from 'next-intl/server'

type Props = {
  family: Family
  studentsCount: number
  enrollmentsCount: number
  showActions?: boolean
  children?: React.ReactNode
}

export async function HeroBanner({
  family,
  studentsCount,
  enrollmentsCount,
  showActions,
  children,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-white">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-3xl border border-white/20">
              👨‍👩‍👧
            </div>
            <div>
              <h1 className="text-3xl font-bold">{family.name}</h1>
              <p className="text-gray-300 text-sm mt-1">{t('subtitle')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-sm text-gray-300">{t('hero.members')}</p>
              <p className="text-2xl font-semibold">{studentsCount + 2}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">{t('hero.children')}</p>
              <p className="text-2xl font-semibold">{studentsCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">{t('hero.enrollments')}</p>
              <p className="text-2xl font-semibold">{enrollmentsCount}</p>
            </div>
          </div>
        </div>

        {showActions && <div className="pt-2">{children}</div>}
      </div>
    </div>
  )
}
