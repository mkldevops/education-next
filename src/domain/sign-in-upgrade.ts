/**
 * Proposition d'une méthode de connexion plus sûre après une connexion par mot de passe.
 * Règles pures ; la lecture des comptes, passkeys et drapeaux plateforme reste au gate
 * (`app/[locale]/(dashboard)/_components/sign-in-upgrade-gate.tsx`).
 */

export type SignInUpgradeOffer = {
  /** « Continuer avec Google » : adresse Gmail et Google réellement proposable. */
  google: boolean
  /** « Créer une clé d'accès » : enregistrement de passkeys ouvert sur la plateforme. */
  passkey: boolean
}

export type SignInUpgradeInput = {
  email: string
  hasGoogleAccount: boolean
  passkeyCount: number
  dismissedAt: Date | null
  /** `isGoogleSignInAvailable()` : drapeau plateforme ET identifiants OAuth présents. */
  googleAvailable: boolean
  /** `isPasskeySignInEnabled()` : gouverne l'enregistrement de nouvelles passkeys. */
  passkeyEnabled: boolean
}

/**
 * Test volontairement étroit : seule la terminaison `@gmail.com` compte, ni `googlemail.com`
 * ni les domaines Workspace, que l'on ne peut pas reconnaître sans interroger Google.
 */
export function isGmailAddress(email: string): boolean {
  return email.toLowerCase().endsWith('@gmail.com')
}

/**
 * `null` : rien à proposer. Sinon les deux options possibles, dont au moins une est vraie.
 * Le navigateur décide ensuite seul de masquer la passkey quand WebAuthn manque. L'emprunt
 * d'identité est écarté en amont, par le gate, avant toute lecture du compte.
 */
export function resolveSignInUpgradeOffer(input: SignInUpgradeInput): SignInUpgradeOffer | null {
  if (input.dismissedAt) return null
  if (input.hasGoogleAccount || input.passkeyCount > 0) return null

  const offer = {
    google: input.googleAvailable && isGmailAddress(input.email),
    passkey: input.passkeyEnabled,
  }

  return offer.google || offer.passkey ? offer : null
}
