/**
 * Deux créations simultanées passent toutes deux la vérification préalable du nom : l'index
 * unique partiel `Level(schoolId, name) WHERE isActive` tranche alors, et son refus (P2002)
 * doit redevenir le même `'nameTaken'` plutôt qu'une erreur serveur.
 */
export function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
