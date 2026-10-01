import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { impersonationLogGateway } from '@/gateways/impersonation-log-gateway'
import { userGateway } from '@/gateways/user-gateway'
import {
  sendChangeEmailConfirmationEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from '@/lib/auth-emails'
import { db } from '@/lib/db'
import { impersonation } from '@/lib/impersonation'

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    // Aucune inscription libre : `POST /api/auth/sign-up/email` répond 400. Les deux
    // seuls chemins de création de compte — acceptation d'invitation et
    // `createUserAction` — passent par `credentialUserGateway`, hors endpoint.
    disableSignUp: true,
    // Pas de preuve d'adresse exigée à la connexion : chaque compte naît d'une
    // adresse déjà prouvée (voir `emailVerification` ci-dessous).
    requireEmailVerification: false,
    // Une réinitialisation prouve la boîte mail : toute session ouverte avant elle,
    // par exemple par un tiers qui aurait créé le compte, doit tomber.
    revokeSessionsOnPasswordReset: true,
    // Chaque callback d'email reçoit la requête d'origine en second argument ; sa locale
    // choisit la langue du message (`src/lib/auth-emails.ts`).
    sendResetPassword: sendResetPasswordEmail,
  },
  emailVerification: {
    // Pas d'envoi à l'inscription : les deux seuls chemins de création de compte
    // partent d'une adresse déjà prouvée — jeton d'invitation reçu sur cette
    // adresse, ou `createUserAction` qui marque `emailVerified` aussitôt. Un
    // email de vérification n'y apprendrait rien. Les émetteurs réels sont
    // `auth.api.sendVerificationEmail` (changement d'adresse par un admin) et
    // `user.changeEmail`, qui s'appuie sur ce même callback.
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail,
  },
  user: {
    changeEmail: {
      enabled: true,
      // La confirmation part sur l'adresse **actuelle**, seule déjà vérifiée : un
      // détournement de compte ne peut donc pas se valider depuis la nouvelle
      // adresse choisie par l'attaquant.
      sendChangeEmailConfirmation: sendChangeEmailConfirmationEmail,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // Google connecte ou se lie à un compte existant, il n'en crée jamais.
      // `disableSignUp` couvre le retour de redirection ; `disableImplicitSignUp`
      // couvre le flux `idToken`, qui ne lit pas `disableSignUp`. Le hook
      // `databaseHooks.user.create.before` ferme le `requestSignUp` restant.
      disableSignUp: true,
      disableImplicitSignUp: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Filet unique pour toute voie d'inscription, présente ou future : aucun
        // endpoint Better Auth ne crée d'utilisateur. Seul un appel serveur hors
        // requête (`credentialUserGateway`) s'exécute sans contexte d'endpoint.
        before: async (_user, endpointContext) => (endpointContext ? false : undefined),
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
    },
  },
  advanced: {
    cookiePrefix: 'education-next',
  },
  plugins: [
    impersonation({
      findUser: (id) => userGateway.findManaged(id),
      log: impersonationLogGateway,
    }),
  ],
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
