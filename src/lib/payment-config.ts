/**
 * Drapeau d'école gouvernant toute la gestion de l'argent : encaissements, formules
 * tarifaires, montants d'inscription, paiement en ligne, outils MCP d'argent.
 *
 * Il se lit à l'inverse de `teacher_expenses_enabled` : celui-là ouvre une fonction que
 * personne n'avait, celui-ci ferme une fonction que toute école en service possède déjà.
 * L'absence de ligne vaut donc **activé** (`readsAsEnabled`), et aucune migration ne
 * sème `'false'` sur une école existante.
 */
export const PAYMENTS_ENABLED_CONFIG_KEY = 'payments_enabled'

export const PAYMENTS_ENABLED_CONFIG_DEFAULT = {
  name: PAYMENTS_ENABLED_CONFIG_KEY,
  value: 'true',
  valueType: 'BOOLEAN',
} as const

/**
 * Nom technique de la formule réservée portée par une inscription posée alors que les
 * paiements sont coupés. `Enrollment.planId` est obligatoire : sans cette ligne, une
 * école qui ne tarife pas ne pourrait pas inscrire.
 *
 * Elle n'est jamais catalogable ni sélectionnable, et son libellé affiché vient de
 * `messages/*.json` — le nom stocké n'est pas destiné à l'œil.
 */
export const UNPRICED_PLAN_NAME = '__unpriced__'
