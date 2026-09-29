/**
 * Origine publique de ce déploiement, même repli que `auth.ts` et `auth-client.ts`.
 *
 * C'est elle qui identifie le site pour OAuth : émetteur des jetons, ressource protégée
 * et audience figée dans chaque connexion en dérivent. Elle n'est jamais lue depuis la
 * requête entrante, dont l'en-tête `Host` est écrit par l'appelant.
 */
export function appOrigin(): string {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').origin
}
