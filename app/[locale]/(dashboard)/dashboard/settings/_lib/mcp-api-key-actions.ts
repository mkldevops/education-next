'use server'

import { revalidatePath } from 'next/cache'
import { isImpersonatingRequest } from '@/lib/impersonation-guard'
import { createMcpApiKey } from '@/use-cases/mcp/create-mcp-api-key'
import { revokeMcpApiKey } from '@/use-cases/mcp/revoke-mcp-api-key'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { requireSchoolAdmin } from '../../../_lib/auth-helper'
import { type McpApiKeyView, toMcpApiKeyView } from './mcp-api-key-view'

type CreateResult =
  | { key: string; record: McpApiKeyView }
  | 'validationError'
  | 'tooManyKeys'
  | 'mcpDisabled'
  | 'impersonating'

/**
 * Le drapeau plateforme est relu ici et pas seulement au rendu de l'onglet : une action
 * reste appelable quand l'onglet a disparu, et une clé émise pour un serveur éteint n'a
 * aucune raison d'exister.
 */
export async function createMcpApiKeyAction(input: {
  name: string
  lifetimeDays: number
}): Promise<CreateResult> {
  const { schoolId, userId } = await requireSchoolAdmin()
  // Une clé émise pendant un emprunt ouvrirait le serveur MCP sous l'identité de la cible,
  // bien après la fin de la session empruntée.
  if (await isImpersonatingRequest()) return 'impersonating' as const
  if (!(await isMcpEnabled())) return 'mcpDisabled' as const

  const result = await createMcpApiKey({ ...input, userId, schoolId })
  if (typeof result === 'string') return result

  revalidatePath('/dashboard/settings')

  return { key: result.key, record: toMcpApiKeyView(result.record) }
}

export async function revokeMcpApiKeyAction(id: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  if (await isImpersonatingRequest()) return 'impersonating' as const

  const result = await revokeMcpApiKey(id, userId, schoolId)
  if (result !== 'OK') return result

  revalidatePath('/dashboard/settings')

  return 'OK' as const
}
