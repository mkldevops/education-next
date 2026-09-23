import { createLocalAccountIssuer } from 'better-auth/db'
import { auth } from '@/lib/auth'

type CredentialUserInput = {
  name: string
  email: string
  password: string
}

/**
 * Seule écriture d'un compte email + mot de passe.
 *
 * L'inscription publique est fermée (`emailAndPassword.disableSignUp`), ce qui
 * ferme aussi `auth.api.signUpEmail` côté serveur. Les deux chemins légitimes —
 * acceptation d'invitation et `createUserAction` — créent donc le compte ici, par
 * l'adapter interne de Better Auth : même hachage, même ligne `Account`
 * `credential` que l'endpoint d'inscription, sans session ni cookie.
 *
 * L'appel s'exécute hors endpoint, ce qui le laisse passer le hook
 * `databaseHooks.user.create.before` qui refuse toute création pendant une requête
 * Better Auth. L'adresse est considérée prouvée (`emailVerified: true`) : le jeton
 * d'invitation a été reçu sur cette boîte, ou un administrateur l'a saisie.
 */
export const credentialUserGateway = {
  async create(input: CredentialUserInput): Promise<{ id: string }> {
    const context = await auth.$context
    const { minPasswordLength, maxPasswordLength } = context.password.config
    if (input.password.length < minPasswordLength || input.password.length > maxPasswordLength) {
      throw new Error('Invalid password length')
    }

    const email = input.email.toLowerCase()
    if (await context.internalAdapter.findUserByEmail(email)) {
      throw new Error('Email already used')
    }

    const hash = await context.password.hash(input.password)
    const user = await context.internalAdapter.createUser(
      { name: input.name, email, emailVerified: true },
      { method: 'email-password' }
    )
    if (!user) throw new Error('User creation refused')

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
}
