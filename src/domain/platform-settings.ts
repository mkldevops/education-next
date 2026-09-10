/** Réglage plateforme gouvernant la bascule d'école pour toute l'instance. */
export const SCHOOL_SWITCH_SETTING = 'school_switch_enabled'

/** Réglage plateforme gouvernant la connexion Google pour toute l'instance. */
export const GOOGLE_SIGN_IN_SETTING = 'google_sign_in_enabled'

/** Réglage plateforme gouvernant la connexion par passkey pour toute l'instance. */
export const PASSKEY_SIGN_IN_SETTING = 'passkey_sign_in_enabled'

/**
 * Les écritures que ce dépôt produit ne posent que `'true'` ou `'false'` — `BOOLEAN` est
 * validé par `set-platform-setting`. La normalisation couvre un réglage écrit autrement :
 * `validateValueType` laisse passer n'importe quelle chaîne pour un type `TEXT`, donc un
 * futur éditeur générique pourrait stocker `'FALSE'` ou `'0'`, qu'une comparaison brute
 * lirait comme « activé » à l'inverse de l'intention.
 */
const DISABLED_VALUES = new Set(['false', '0', 'off', 'no'])

/**
 * Verdict du drapeau depuis sa valeur brute.
 *
 * L'absence de ligne vaut activé : la migration ne sème rien, donc une installation
 * existante conserve sa bascule. Une valeur qui n'exprime aucun refus vaut également
 * activé — un réglage illisible ne doit pas retirer silencieusement une fonction en place.
 */
export function readsAsEnabled(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true

  return !DISABLED_VALUES.has(value.trim().toLowerCase())
}
