import { getTranslations } from 'next-intl/server'
import type { FamilyDetailStudent } from '../_lib/family-detail'
import { ChildCard, type ClassOption } from './child-card'

type Props = {
  students: FamilyDetailStudent[]
  pendingCount: number
  locale: string
  currency: string
  familyId: string
  isAdmin: boolean
  classes: ClassOption[]
  studentsEnrolledInSelectedPeriod: ReadonlySet<string>
  paymentsEnabled: boolean
}

export async function ChildrenTab({
  students,
  pendingCount,
  locale,
  currency,
  familyId,
  isAdmin,
  classes,
  studentsEnrolledInSelectedPeriod,
  paymentsEnabled,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="rounded bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-900">{t('alert.needsAttention')}</h3>
            <p className="text-sm text-amber-800 mt-1">
              {t('alert.pendingCount', { count: pendingCount })}
            </p>
          </div>
        </div>
      )}
      {students.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {students.map((student) => (
            <ChildCard
              key={student.person.id}
              student={student}
              locale={locale}
              currency={currency}
              familyId={familyId}
              isAdmin={isAdmin}
              classes={classes}
              canEnroll={!studentsEnrolledInSelectedPeriod.has(student.person.student.id)}
              paymentsEnabled={paymentsEnabled}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-graphite-600 text-center py-8">{t('sections.noChildren')}</p>
      )}
    </div>
  )
}
