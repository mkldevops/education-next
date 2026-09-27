import { resolveAiAssistantModel } from '@/domain/ai-assistant'
import { getSchoolContext, isActiveSchoolAdmin } from '@/lib/school-context'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { getOpenRouterKeyStatus } from '@/use-cases/platform-settings/openrouter-api-key'
import { AssistantLauncher } from './assistant-launcher'

/**
 * N'affiche le lanceur qu'à un administrateur de l'école active, drapeau ouvert et clé
 * configurée. La route revérifie chaque condition à chaque tour : ce filtre n'est
 * qu'un confort d'affichage.
 */
export async function AssistantDock() {
  const context = await getSchoolContext()
  if (!context || !isActiveSchoolAdmin(context)) return null
  if (!(await isAiAssistantEnabled())) return null
  if ((await getOpenRouterKeyStatus()) !== 'configured') return null

  return (
    <AssistantLauncher
      key={context.schoolId}
      model={resolveAiAssistantModel(process.env.AI_ASSISTANT_MODEL)}
    />
  )
}
