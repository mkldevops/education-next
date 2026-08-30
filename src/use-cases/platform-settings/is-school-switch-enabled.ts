import { readsAsEnabled, SCHOOL_SWITCH_SETTING } from '@/domain/platform-settings'
import { getPlatformSetting } from './get-platform-setting'

/**
 * État de la bascule d'école pour un membre ordinaire. Un super-admin n'est jamais
 * soumis au drapeau : ses appelants tranchent avant d'arriver ici.
 */
export async function isSchoolSwitchEnabled(
  getSetting: typeof getPlatformSetting = getPlatformSetting
): Promise<boolean> {
  const setting = await getSetting({ name: SCHOOL_SWITCH_SETTING })

  // Le nom est une constante : `validationError` est inatteignable, et `notFound` est
  // le cas nominal d'une installation qui n'a jamais touché au réglage.
  return readsAsEnabled(typeof setting === 'string' ? null : setting.value)
}
