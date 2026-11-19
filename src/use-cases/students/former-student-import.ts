import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  classifyFormerStudents,
  type ExistingStudent,
  FORMER_STUDENT_FIELDS,
  FORMER_STUDENT_IMPORT_LIMITS,
  type FormerStudentDraft,
  type FormerStudentPreviewRow,
  formerClassLabel,
  formerStudentLeftAt,
  isImportable,
} from '@/domain/former-student-import'
import { acquireAdvisoryLock } from '@/gateways/advisory-lock'
import type { Prisma } from '@/generated/prisma/client'
import { dbArchived } from '@/lib/db'

const { maxRows } = FORMER_STUDENT_IMPORT_LIMITS
/** Bornes de transport seulement : la validation métier (dates, longueurs) rend `incomplete`. */
const field = z
  .string()
  .max(500)
  .transform((value) => value.trim())

const draftSchema = z.object({
  id: z.string().min(1).max(64),
  lastname: field,
  firstname: field,
  birthday: field,
  className: field,
  departureYear: field,
  included: z.boolean(),
  uncertain: z.array(z.enum(FORMER_STUDENT_FIELDS)).max(FORMER_STUDENT_FIELDS.length),
})

const formerStudentImportSchema = z.object({
  schoolId: z.string().min(1),
  rows: z.array(draftSchema).max(maxRows),
})

type ImportInput = z.input<typeof formerStudentImportSchema>

type Reader = Pick<Prisma.TransactionClient, 'student'>

/**
 * Tous les élèves de l'école, actifs et archivés : `dbArchived` lève le filtre de suppression
 * logique pour qu'un ancien déjà importé soit retrouvé, la garde de tenant vérifie `schoolId`.
 */
async function loadExistingStudents(client: Reader, schoolId: string): Promise<ExistingStudent[]> {
  const students = await client.student.findMany({
    where: { schoolId },
    select: { birthday: true, isActive: true, person: { select: { name: true, lastname: true } } },
  })
  return students.map((student) => ({
    lastname: student.person.lastname,
    firstname: student.person.name,
    birthday: student.birthday ? student.birthday.toISOString().slice(0, 10) : null,
    isActive: student.isActive,
  }))
}

/** Statut de chaque ligne relue, recalculé côté serveur à chaque modification. */
export async function previewFormerStudentImport(
  input: ImportInput,
  now = new Date()
): Promise<{ status: 'OK'; preview: FormerStudentPreviewRow[] } | { status: 'validationError' }> {
  const parsed = formerStudentImportSchema.safeParse(input)
  if (!parsed.success) return { status: 'validationError' }
  const { schoolId, rows } = parsed.data
  const existing = await loadExistingStudents(dbArchived, schoolId)
  return { status: 'OK', preview: classifyFormerStudents(rows, existing, now) }
}

/**
 * Crée les anciens élèves confirmés : une personne et un élève archivé (`isActive: false`,
 * `leftAt` posé) par ligne, sans inscription, famille, paiement ni présence. Les statuts sont
 * recalculés dans la transaction, sous un verrou par école : deux confirmations simultanées ou
 * un import rejoué ne créent jamais deux fois le même élève.
 */
export async function commitFormerStudentImport(
  input: ImportInput,
  now = new Date()
): Promise<{ status: 'OK'; created: number; skipped: number } | { status: 'validationError' }> {
  const parsed = formerStudentImportSchema.safeParse(input)
  if (!parsed.success) return { status: 'validationError' }
  const { schoolId, rows } = parsed.data
  const included: FormerStudentDraft[] = rows.filter((row) => row.included)

  return dbArchived.$transaction(
    async (tx) => {
      await acquireAdvisoryLock(tx, `former-student-import:${schoolId}`)
      const existing = await loadExistingStudents(tx, schoolId)
      const preview = classifyFormerStudents(included, existing, now)
      const toCreate = included.filter((row, index) => {
        const entry = preview[index]
        return entry !== undefined && isImportable(row, entry)
      })

      const people = toCreate.map((row) => ({
        id: randomUUID(),
        schoolId,
        name: row.firstname,
        lastname: row.lastname,
      }))
      if (people.length > 0) {
        await tx.person.createMany({ data: people })
        await tx.student.createMany({
          data: toCreate.map((row, index) => ({
            id: randomUUID(),
            schoolId,
            personId: people[index]?.id as string,
            birthday: row.birthday ? new Date(`${row.birthday}T00:00:00.000Z`) : null,
            formerClassLabel: formerClassLabel(row.className),
            isActive: false,
            leftAt: formerStudentLeftAt(row.departureYear, now),
          })),
        })
      }
      return {
        status: 'OK' as const,
        created: toCreate.length,
        skipped: included.length - toCreate.length,
      }
    },
    { isolationLevel: 'ReadCommitted', timeout: 30_000 }
  )
}
