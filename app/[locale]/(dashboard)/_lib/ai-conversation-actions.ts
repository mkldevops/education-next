'use server'

import {
  deleteConversation,
  listConversations,
  loadConversation,
} from '@/use-cases/ai-assistant/conversations'
import { requireSchoolAdmin } from './auth-helper'

/**
 * Historique de l'assistant : chacun ne voit que ses conversations dans l'école active.
 */
export async function listAiConversations() {
  const { schoolId, userId } = await requireSchoolAdmin()
  return listConversations({ schoolId, userId })
}

export async function loadAiConversation(id: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  return loadConversation({ schoolId, userId }, id)
}

export async function deleteAiConversation(id: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  return deleteConversation({ schoolId, userId }, id)
}
