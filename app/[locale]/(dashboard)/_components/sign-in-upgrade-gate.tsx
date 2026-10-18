import { headers } from 'next/headers'
import { resolveSignInUpgradeOffer } from '@/domain/sign-in-upgrade'
import { isImpersonating } from '@/domain/user'
import { SignInUpgradeBanner } from '@/features/auth'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isGoogleSignInAvailable } from '@/use-cases/platform-settings/is-google-sign-in-available'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'

/**
 * Décide, à chaque rendu du tableau de bord, s'il faut proposer Google ou une clé d'accès à
 * un utilisateur connecté par mot de passe. Une seule lecture du compte ; les drapeaux
 * plateforme passent par `readPlatformFlag()`, mémoïsé par requête.
 *
 * Un emprunt d'identité s'arrête avant cette lecture : la proposition, comme les identifiants
 * qu'elle crée, appartient à la cible.
 */
export async function SignInUpgradeGate() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if (isImpersonating(session)) return null

  const [user, googleAvailable, passkeyEnabled] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        signInUpgradeDismissedAt: true,
        accounts: { where: { providerId: 'google' }, select: { id: true }, take: 1 },
        _count: { select: { passkeys: true } },
      },
    }),
    isGoogleSignInAvailable(),
    isPasskeySignInEnabled(),
  ])
  if (!user) return null

  const hasGoogleAccount = user.accounts.length > 0
  const offer = resolveSignInUpgradeOffer({
    email: session.user.email,
    hasGoogleAccount,
    passkeyCount: user._count.passkeys,
    dismissedAt: user.signInUpgradeDismissedAt,
    googleAvailable,
    passkeyEnabled,
  })

  return <SignInUpgradeBanner offer={offer} googleLinked={hasGoogleAccount} />
}
