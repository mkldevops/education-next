import { AI_ASSISTANT_ENABLED_SETTING } from '@/domain/platform-settings'
import type { getPlatformSetting } from './get-platform-setting'
import { readPlatformOptInFlag } from './read-platform-flag'

/**
 * État de l'assistant d'inscription pour toute l'instance, **désactivé par défaut**.
 *
 * Même inversion que le MCP : la fonction envoie des photos de fiches à un fournisseur
 * externe, elle s'ouvre par un choix explicite. Relu à chaque appel de la route de chat et
 * des actions de prévisualisation et de confirmation, jamais mis en cache entre requêtes.
 */
export function isAiAssistantEnabled(getSetting?: typeof getPlatformSetting): Promise<boolean> {
  return readPlatformOptInFlag(AI_ASSISTANT_ENABLED_SETTING, getSetting)
}
