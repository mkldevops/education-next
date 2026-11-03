import { createAuthClient } from 'better-auth/react'
import { impersonationClient } from './impersonation-client'

const authClient = createAuthClient({
  plugins: [impersonationClient()],
})

// `signUp` a disparu avec le flux `/register`, et l'endpoint est fermé côté serveur
// (`disableSignUp`) : un compte naît d'une invitation acceptée ou de `createUserAction`
// (sans mot de passe, défini ensuite par lien), tous deux via `credentialUserGateway`.
export const { signIn, signOut, linkSocial, unlinkAccount, resetPassword, requestPasswordReset } =
  authClient

export const { impersonateUser, stopImpersonating } = authClient.admin
