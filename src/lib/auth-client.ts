import { createAuthClient } from 'better-auth/react'
import { impersonationClient } from './impersonation-client'

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [impersonationClient()],
})

// `signUp` a disparu avec le flux `/register`, et l'endpoint est fermé côté serveur
// (`disableSignUp`) : un compte naît d'une invitation acceptée ou de `createUserAction`,
// tous deux via `credentialUserGateway`.
export const { signIn, signOut, linkSocial, unlinkAccount, resetPassword, requestPasswordReset } =
  authClient

export const { impersonateUser, stopImpersonating } = authClient.admin
