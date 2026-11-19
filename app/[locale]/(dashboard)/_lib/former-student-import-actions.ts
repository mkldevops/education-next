'use server'

import { revalidatePath } from 'next/cache'
import type { FormerStudentDraft } from '@/domain/former-student-import'
import {
  extractFormerStudents,
  type UploadedFile,
} from '@/use-cases/students/extract-former-students'
import {
  commitFormerStudentImport,
  previewFormerStudentImport,
} from '@/use-cases/students/former-student-import'
import { requireSchoolAdmin } from './auth-helper'
import { openRouterFormerStudentExtractor } from './former-student-extractor'

/**
 * Lecture IA des fichiers déposés, suivie d'un premier aperçu. Rien n'est écrit. Admin seulement :
 * l'école vient de la garde, jamais du formulaire.
 */
export async function extractFormerStudentsAction(formData: FormData) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const entries = formData.getAll('files')
  if (entries.some((entry) => !(entry instanceof File))) return { status: 'forbiddenFile' as const }

  const files: UploadedFile[] = await Promise.all(
    (entries as File[]).map(async (file) => ({
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }))
  )
  const extracted = await extractFormerStudents(
    { schoolId, userId, files },
    { extract: openRouterFormerStudentExtractor }
  )
  if (extracted.status !== 'OK') return extracted

  const preview = await previewFormerStudentImport({ schoolId, rows: extracted.rows })
  if (preview.status !== 'OK') return { status: 'unreadable' as const }
  return {
    status: 'OK' as const,
    rows: extracted.rows,
    preview: preview.preview,
    truncated: extracted.truncated,
  }
}

/** Statuts recalculés après une correction de l'école. */
export async function previewFormerStudentsAction(rows: FormerStudentDraft[]) {
  const { schoolId } = await requireSchoolAdmin()
  return previewFormerStudentImport({ schoolId, rows })
}

/** Seule écriture de l'import : élèves archivés, sans inscription ni famille. */
export async function commitFormerStudentsAction(rows: FormerStudentDraft[]) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await commitFormerStudentImport({ schoolId, rows })
  if (result.status !== 'OK') return result

  revalidatePath('/dashboard/students')
  return result
}
