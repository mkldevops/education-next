import type { z } from 'zod'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { MCP_STUDENT_SEARCH_DEFAULT, mcpFindStudentsSchema } from './schemas'

type Input = z.infer<typeof mcpFindStudentsSchema>

/**
 * Désigne un élève par son nom pour les autres outils : chaque mot doit se retrouver dans
 * le prénom ou le nom. Rend ses familles et ses inscriptions ouvertes, avec leur classe.
 */
export async function findStudentsFromMcp(
  scope: { schoolId: string },
  input: Input,
  readGw = mcpReadGateway
) {
  const parsed = mcpFindStudentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { query, limit = MCP_STUDENT_SEARCH_DEFAULT } = parsed.data

  const rows = await readGw.findStudents(scope.schoolId, query, limit)
  return rows.map((row) => ({
    id: row.id,
    name: row.person.name,
    lastname: row.person.lastname,
    families: row.person.families.map((link) => link.family),
    enrollments: row.enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      plan: enrollment.plan,
      classes: enrollment.classAssignments.map((assignment) => assignment.classPeriod),
    })),
  }))
}
