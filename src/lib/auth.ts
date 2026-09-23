import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { userGateway } from '@/gateways/user-gateway'
import { db } from '@/lib/db'
import { impersonation } from '@/lib/impersonation'
import { sendPlatformEmail } from '@/lib/platform-email'

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
    // Ces callbacks sont invoqués hors requête localisée : Better Auth ne fournit
    // pas de locale, d'où des libellés en français comme le reste des surfaces
    // plateforme.
    sendResetPassword: async (data) => {
      await sendPlatformEmail(data.user.email, 'Réinitialisation de votre mot de passe', {
        preheader: 'Lien de réinitialisation valable une heure.',
        heading: 'Réinitialisation de votre mot de passe',
        paragraphs: [
          'Une réinitialisation de mot de passe a été demandée pour ce compte. Utilisez le bouton ci-dessous pour en choisir un nouveau.',
        ],
        cta: { label: 'Choisir un mot de passe', url: data.url },
        notice: 'Ce lien expire dans 1 heure.',
        footer:
          "Message automatique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste valable.",
      })
    },
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
    sendVerificationEmail: async ({ user, url }) => {
      await sendPlatformEmail(user.email, 'Confirmez votre adresse email', {
        preheader: 'Une seule étape pour confirmer votre adresse.',
        heading: 'Confirmez votre adresse email',
        paragraphs: [
          `Cette adresse a été renseignée pour le compte ${user.email}. La confirmer garantit que les messages de la plateforme — invitations, réinitialisation de mot de passe — vous parviennent.`,
        ],
        cta: { label: 'Confirmer mon adresse', url },
        notice: "Sans confirmation, ce lien reste le seul moyen de valider l'adresse.",
        footer:
          "Message automatique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      })
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      // La confirmation part sur l'adresse **actuelle**, seule déjà vérifiée : un
      // détournement de compte ne peut donc pas se valider depuis la nouvelle
      // adresse choisie par l'attaquant.
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendPlatformEmail(user.email, "Confirmez le changement d'adresse email", {
          preheader: `Nouvelle adresse demandée : ${newEmail}`,
          heading: "Confirmez le changement d'adresse",
          paragraphs: [
            `Une demande de remplacement de ${user.email} par ${newEmail} a été enregistrée pour ce compte.`,
            "Ce message part sur l'adresse actuelle : sans cette confirmation, l'adresse du compte reste inchangée.",
          ],
          cta: { label: 'Confirmer la nouvelle adresse', url },
          notice: `Après confirmation, la connexion se fera avec l'adresse ${newEmail}.`,
          footer:
            "Message automatique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et changez votre mot de passe.",
        })
      },
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
  plugins: [impersonation({ findUser: (id) => userGateway.findManaged(id) })],
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
