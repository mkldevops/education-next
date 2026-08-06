'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

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

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return 'unauthorized' as const

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser) return 'unauthorized' as const

  const isAdmin = dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN'

  let familyId: string | undefined
  if (dbUser.role === 'PARENT') {
    const userFamily = await db.userFamily.findFirst({
      where: { userId: session.user.id },
      select: { familyId: true },
    })
    familyId = userFamily?.familyId
  }

  if (!isAdmin && !familyId) return []

  const searchQuery = parsed.data.query.toLowerCase()

  const [students, families] = await Promise.all([
    db.student.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                person: {
                  name: {
                    contains: searchQuery,
                    mode: 'insensitive',
                  },
                },
              },
              {
                person: {
                  lastname: {
                    contains: searchQuery,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          },
          {
            person: {
              isActive: true,
            },
          },
          isAdmin
            ? {}
            : {
                person: {
                  families: {
                    some: {
                      familyId,
                    },
                  },
                },
              },
        ],
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
    isAdmin
      ? db.family.findMany({
          where: {
            AND: [
              {
                name: {
                  contains: searchQuery,
                  mode: 'insensitive',
                },
              },
              {
                isActive: true,
              },
            ],
          },
          select: {
            id: true,
            name: true,
            _count: { select: { persons: true } },
          },
          take: 5,
        })
      : db.family.findMany({
          where: {
            AND: [
              {
                name: {
                  contains: searchQuery,
                  mode: 'insensitive',
                },
              },
              {
                isActive: true,
              },
              {
                id: familyId,
              },
            ],
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
