'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { getSchoolContext, hasActiveSchoolStaffAccess } from '@/lib/school-context'

const searchSchema = z.object({
  query: z.string().min(1).max(250),
})

type SearchResult =
  | {
      type: 'family'
      id: string
      name: string
      memberCount: number
    }
  | {
      type: 'student'
      id: string
      name: string
      secondaryInfo: string
    }

export async function searchStudentsAndFamilies(
  query: string
): Promise<SearchResult[] | 'unauthorized' | 'validationError'> {
  const parsed = searchSchema.safeParse({ query })
  if (!parsed.success) return 'validationError' as const

  const context = await getSchoolContext()
  if (!context) return 'unauthorized' as const

  const { schoolId } = context
  // L'équipe (administration, enseignant à accès élargi) cherche dans toute l'école.
  const isStaff = await hasActiveSchoolStaffAccess(context)
  const familyId = context.role === 'PARENT' ? (context.familyId ?? undefined) : undefined

  if (!isStaff && !familyId) return []

  const searchQuery = parsed.data.query

  const [students, families] = await Promise.all([
    db.student.findMany({
      where: {
        schoolId,
        person: {
          isActive: true,
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { lastname: { contains: searchQuery, mode: 'insensitive' } },
          ],
          ...(isStaff ? {} : { families: { some: { familyId } } }),
        },
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            lastname: true,
            families: {
              where: { family: { isActive: true } },
              select: { family: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
      take: 5,
    }),
    db.family.findMany({
      where: {
        schoolId,
        isActive: true,
        name: { contains: searchQuery, mode: 'insensitive' },
        ...(isStaff ? {} : { id: familyId }),
      },
      select: {
        id: true,
        name: true,
        _count: { select: { persons: true } },
      },
      take: 5,
    }),
  ])

  const results: SearchResult[] = [
    ...students.map((student) => ({
      type: 'student' as const,
      id: student.id,
      name: `${student.person.name} ${student.person.lastname}`,
      secondaryInfo: student.person.families[0]?.family.name ?? '',
    })),
    ...families.map((family) => ({
      type: 'family' as const,
      id: family.id,
      name: family.name,
      memberCount: family._count.persons,
    })),
  ]

  return results
}
