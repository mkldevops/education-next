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
      secondaryInfo: string
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
    select: { roles: true },
  })
  if (!dbUser) return 'unauthorized' as const

  const rolesRaw = dbUser.roles
  const roles: string[] = Array.isArray(rolesRaw)
    ? rolesRaw
    : typeof rolesRaw === 'string'
      ? JSON.parse(rolesRaw)
      : []

  let familyId: string | undefined
  if (roles.includes('family')) {
    const userFamily = await db.userFamily.findFirst({
      where: { userId: session.user.id },
      select: { familyId: true },
    })
    familyId = userFamily?.familyId
  }

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
          roles.includes('admin')
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
          },
        },
      },
      take: 5,
    }),
    roles.includes('admin')
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
            users: {
              select: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
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
            users: {
              select: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
          take: 5,
        }),
  ])

  const results: SearchResult[] = [
    ...students.map((student) => ({
      type: 'student' as const,
      id: student.id,
      name: `${student.person.name} ${student.person.lastname}`,
      secondaryInfo: `${student.person.name}`,
    })),
    ...families.map((family) => ({
      type: 'family' as const,
      id: family.id,
      name: family.name,
      secondaryInfo: `${family.users.length} member(s)`,
    })),
  ]

  return results
}
