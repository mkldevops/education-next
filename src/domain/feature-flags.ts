/**
 * Les écritures que ce dépôt produit ne posent que `'true'` ou `'false'` — `BOOLEAN` est
 * validé par `set-platform-setting` et par `set-config`. La normalisation couvre un
 * réglage écrit autrement : `validateValueType` laisse passer n'importe quelle chaîne pour
 * un type `TEXT`, donc l'éditeur générique de `/dashboard/config` pourrait stocker
 * `'FALSE'` ou `'0'`, qu'une comparaison brute lirait comme « activé » à l'inverse de
 * l'intention.
 */
const DISABLED_VALUES: Record<string, true> = { false: true, '0': true, off: true, no: true }

/**
 * Verdict du drapeau depuis sa valeur brute.
 *
 * L'absence de ligne vaut activé : la migration ne sème rien, donc une installation
 * existante conserve sa bascule. Une valeur qui n'exprime aucun refus vaut également
 * activé — un réglage illisible ne doit pas retirer silencieusement une fonction en place.
 */
export function readsAsEnabled(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true

  return DISABLED_VALUES[value.trim().toLowerCase()] !== true
}

const ENABLED_VALUES: Record<string, true> = { true: true, '1': true, on: true, yes: true }

/**
 * Verdict inverse, pour les fonctions qui doivent être explicitement ouvertes.
 *
 * L'absence de ligne vaut désactivé : le serveur MCP est une API d'écriture machine,
 * elle ne doit pas s'ouvrir d'elle-même au premier déploiement qui embarque la
 * migration. Seule une valeur affirmative l'active.
 */
export function readsAsOptedIn(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false

  return ENABLED_VALUES[value.trim().toLowerCase()] === true
}
