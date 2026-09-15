import { createAuthClient } from 'better-auth/react'
import { impersonationClient } from './impersonation-client'

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [impersonationClient()],
})

// `signUp` a disparu avec le flux `/register` : l'invitation est désormais le seul
// chemin de création de compte, et elle passe par `auth.api.signUpEmail` côté serveur.
export const { signIn, signOut, linkSocial, unlinkAccount, resetPassword, requestPasswordReset } =
  authClient

export const { impersonateUser, stopImpersonating } = authClient.admin
