/** Réglage plateforme gouvernant la bascule d'école pour toute l'instance. */
export const SCHOOL_SWITCH_SETTING = 'school_switch_enabled'

/**
 * Verdict du drapeau depuis sa valeur brute.
 *
 * L'absence de ligne vaut activé : la migration ne sème rien, donc une installation
 * existante conserverait sa bascule. Une valeur inattendue vaut également activé —
 * un réglage illisible ne doit pas retirer silencieusement une fonction en place.
 */
export function readsAsEnabled(value: string | null | undefined): boolean {
  return value !== 'false'
}
