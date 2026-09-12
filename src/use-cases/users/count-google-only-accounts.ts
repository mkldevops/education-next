import { userGateway } from '@/gateways/user-gateway'

/**
 * Nombre de comptes dont Google est l'unique identifiant de connexion — utilisé par
 * `/dashboard/auth-settings` pour avertir avant de couper `google_sign_in_enabled`.
 *
 * Ne tient pas compte d'une passkey éventuellement enregistrée : contrairement au mot
 * de passe, la connexion par passkey est elle-même gouvernée par un drapeau indépendant
 * (`passkey_sign_in_enabled`) que l'administrateur peut couper séparément. Ancrer ce
 * compte sur les identifiants structurels du compte (Google, ou non) le garde stable
 * quel que soit l'état courant de cet autre drapeau, et le mot de passe oublié — le
 * rattrapage nommé par l'avertissement — fonctionne pour ces comptes dans tous les cas.
 */
export function countGoogleOnlyAccounts(
  countGoogleOnly: typeof userGateway.countGoogleOnlyAccounts = userGateway.countGoogleOnlyAccounts
): Promise<number> {
  return countGoogleOnly()
}
