'use server'

import { revalidatePath } from 'next/cache'
import { isImpersonatingRequest } from '@/lib/impersonation-guard'
import { revokeMcpOAuthGrant } from '@/use-cases/mcp/oauth/grants'
import { requireSchoolAdmin } from '../../../_lib/auth-helper'

/**
 * Même garde que la révocation d'une clé : l'administrateur de l'école active, hors
 * emprunt d'identité. La connexion cesse au prochain appel du client, jeton d'accès
 * encore valide ou non.
 */
export async function revokeMcpOAuthGrantAction(id: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  if (await isImpersonatingRequest()) return 'impersonating' as const

  const result = await revokeMcpOAuthGrant(id, userId, schoolId)
  if (result !== 'OK') return result

  revalidatePath('/dashboard/settings')

  return 'OK' as const
}
