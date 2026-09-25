import { z } from 'zod'
import { OPENROUTER_API_KEY_SETTING } from '@/domain/platform-settings'
import { platformSettingGateway } from '@/gateways/platform-setting-gateway'
import { decryptSecret, encryptSecret } from '@/lib/secret-crypto'

type SettingGateway = {
  get: (name: string) => Promise<{ value: string } | null>
  set: (data: { name: string; value: string; valueType: 'TEXT' }) => Promise<unknown>
  delete: (name: string) => Promise<unknown>
}

/**
 * Une clé OpenRouter est une chaîne opaque sans espace ; on ne présume rien de plus de
 * son format, qui appartient au fournisseur.
 */
const apiKeySchema = z.string().trim().min(20).max(500).regex(/^\S+$/)

export type OpenRouterKeyStatus = 'configured' | 'notConfigured' | 'unreadable'

/**
 * Enregistre ou remplace la clé, chiffrée avant d'atteindre `PlatformSetting`.
 *
 * `secretStorageNotConfigured` dit que l'instance n'a pas de `SETTINGS_ENCRYPTION_KEY` :
 * refuser vaut mieux que stocker en clair « en attendant ».
 */
export async function setOpenRouterApiKey(
  rawKey: unknown,
  settingGw: SettingGateway = platformSettingGateway
) {
  const parsed = apiKeySchema.safeParse(rawKey)
  if (!parsed.success) return 'validationError' as const

  const encrypted = encryptSecret(parsed.data)
  if (encrypted === 'notConfigured') return 'secretStorageNotConfigured' as const

  await settingGw.set({ name: OPENROUTER_API_KEY_SETTING, value: encrypted, valueType: 'TEXT' })
  return 'OK' as const
}

export async function deleteOpenRouterApiKey(settingGw: SettingGateway = platformSettingGateway) {
  await settingGw.delete(OPENROUTER_API_KEY_SETTING)
  return 'OK' as const
}

/**
 * La clé en clair, pour le serveur seulement. Aucune action ni page ne la renvoie ; le seul
 * lecteur est la route de chat, qui la passe au fournisseur.
 */
export async function readOpenRouterApiKey(
  settingGw: SettingGateway = platformSettingGateway
): Promise<string | null> {
  const setting = await settingGw.get(OPENROUTER_API_KEY_SETTING)
  if (!setting) return null

  const plain = decryptSecret(setting.value)
  return plain === 'notConfigured' || plain === 'unreadable' ? null : plain
}

/**
 * État affichable : jamais la valeur. `unreadable` distingue une clé d'environnement
 * absente ou changée d'une clé jamais saisie — le remède n'est pas le même.
 */
export async function getOpenRouterKeyStatus(
  settingGw: SettingGateway = platformSettingGateway
): Promise<OpenRouterKeyStatus> {
  const setting = await settingGw.get(OPENROUTER_API_KEY_SETTING)
  if (!setting) return 'notConfigured'

  const plain = decryptSecret(setting.value)
  return plain === 'notConfigured' || plain === 'unreadable' ? 'unreadable' : 'configured'
}
