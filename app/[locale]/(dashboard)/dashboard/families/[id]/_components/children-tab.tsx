import { getTranslations } from 'next-intl/server'
import type {
  ClassAssignment,
  ClassPeriod,
  Enrollment,
  Level,
  Payment,
  Period,
  Person,
  Plan,
  Student,
} from '@/generated/prisma/client'
import { ChildCard } from './child-card'

type StudentWithRelation = {
  person: Person & {
    student: Student & {
      enrollments: Array<
        Enrollment & {
          plan: Plan
          payments: Payment[]
          classAssignments: Array<
            ClassAssignment & {
              classPeriod: ClassPeriod & {
                level: Level
                period: Period
              }
            }
          >
        }
      >
    }
  }
}

type ClassOption = {
  id: string
  name: string
}

type Props = {
  students: StudentWithRelation[]
  hasPendingEnrollments: boolean
  pendingCount: number
  locale: string
  familyId: string
  isAdmin: boolean
  classes: ClassOption[]
  studentsEnrolledInSelectedPeriod: ReadonlySet<string>
  paymentsEnabled: boolean
}

export async function ChildrenTab({
  students,
  hasPendingEnrollments,
  pendingCount,
  locale,
  familyId,
  isAdmin,
  classes,
  studentsEnrolledInSelectedPeriod,
  paymentsEnabled,
}: Props) {
  const t = await getTranslations('dashboard.pages.familyDetails')

  return (
    <div className="space-y-4">
      {hasPendingEnrollments && (
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
