import { z } from 'zod'
import { db } from '@/lib/db'

export const reinstateStudentSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.uuid(),
})

/**
 * Brings an archived student back among the active ones. Its closed enrollments stay
 * `COMPLETED` with their end month and remaining debt: a return is re-enrolled through the
 * usual enrollment dialog, never by reopening the departed year.
 */
export async function reinstateStudent(input: z.input<typeof reinstateStudentSchema>) {
  const parsed = reinstateStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, studentId } = parsed.data

  // An update is not filtered by the soft-delete extension: matching `isActive: false` here
  // both finds the archived row and refuses a student of another school or already active.
  const reinstated = await db.student.updateMany({
    where: { schoolId, id: studentId, isActive: false },
    data: { isActive: true, leftAt: null },
  })
  return reinstated.count === 0 ? ('notFound' as const) : ('OK' as const)
}
