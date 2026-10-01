import { createLocalAccountIssuer } from 'better-auth/db'
import { auth } from '@/lib/auth'

type CredentialUserInput = {
  name: string
  email: string
  password: string
}

type PendingUserInput = {
  name: string
  email: string
}

type AuthContext = Awaited<typeof auth.$context>

/**
 * Crée la ligne `User` par l'adapter interne de Better Auth, sans session ni cookie.
 *
 * L'appel s'exécute hors endpoint, ce qui le laisse passer le hook
 * `databaseHooks.user.create.before` qui refuse toute création pendant une requête
 * Better Auth. L'adresse est considérée prouvée (`emailVerified: true`) : le jeton
 * d'invitation a été reçu sur cette boîte, ou un administrateur l'a saisie — et dans
 * ce second cas le compte ne porte aucun identifiant tant que la boîte n'a pas suivi
 * le lien de définition du mot de passe.
 */
async function createVerifiedUser(context: AuthContext, input: PendingUserInput) {
  const email = input.email.toLowerCase()
  if (await context.internalAdapter.findUserByEmail(email)) {
    throw new Error('Email already used')
  }

  const user = await context.internalAdapter.createUser(
    { name: input.name, email, emailVerified: true },
    { method: 'email-password' }
  )
  if (!user) throw new Error('User creation refused')

  return user
}

/**
 * Seules écritures d'un compte plateforme.
 *
 * L'inscription publique est fermée (`emailAndPassword.disableSignUp`), ce qui
 * ferme aussi `auth.api.signUpEmail` côté serveur. Les deux chemins légitimes
 * créent donc le compte ici, par l'adapter interne de Better Auth :
 *
 * - `create` — acceptation d'invitation : l'invité choisit son mot de passe, même
 *   hachage et même ligne `Account` `credential` que l'endpoint d'inscription ;
 * - `createWithoutPassword` — `createUserAction` : aucun `Account`. Un
 *   administrateur ne fixe jamais de mot de passe ; c'est le lien de
 *   réinitialisation, reçu sur la boîte de l'adresse, qui crée le `credential`
 *   (`resetPassword` le crée s'il manque). Sans lui, ni l'administrateur ni
 *   personne ne peut ouvrir de session sur ce compte.
 */
export const credentialUserGateway = {
  async create(input: CredentialUserInput): Promise<{ id: string }> {
    const context = await auth.$context
    const { minPasswordLength, maxPasswordLength } = context.password.config
    if (input.password.length < minPasswordLength || input.password.length > maxPasswordLength) {
      throw new Error('Invalid password length')
    }

    const hash = await context.password.hash(input.password)
    const user = await createVerifiedUser(context, input)

    try {
      await context.internalAdapter.linkAccount({
        userId: user.id,
        providerId: 'credential',
        issuer: createLocalAccountIssuer('credential'),
        accountId: user.id,
        password: hash,
      })
    } catch (error) {
      // Un compte sans identifiant ne servirait à personne et bloquerait l'adresse.
      await context.internalAdapter.deleteUser(user.id).catch(() => undefined)
      throw error
    }

    return { id: user.id }
  },

  async createWithoutPassword(input: PendingUserInput): Promise<{ id: string }> {
    const context = await auth.$context
    const user = await createVerifiedUser(context, input)
    return { id: user.id }
  },
}
